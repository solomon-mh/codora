import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeGit } from '../context/GitAnalyzer';
import { findRecentlyModifiedFiles } from '../context/WorkspaceAnalyzer';
import { extractFunctions, findFunctionTouchedByLines, parseChangedLines } from '../context/CodeContextExtractor';
import { generateQuestion, ALL_QUESTION_TYPES, type FileContext, type TemplateContext } from './QuestionGenerator';
import type { ChallengeCategory, GeneratedQuestion } from './QuestionTypes';
import { QUESTION_TYPE_TO_CATEGORY } from './QuestionTypes';
import type { RollingScoreMap, ScoreCategory } from '../scoring/ScoreTypes';
import { getLogger } from '../../utils/logger';
import { tryGenerateAIQuestion } from './AIQuestionGenerator';
import type { AIProvider } from '../ai/AITypes';
import { pickDifficulty } from './QuestionDifficulty';
import { questionFingerprint } from './questionFingerprint';

const MAX_FILE_READ_BYTES = 200_000;

export interface GenerateChallengeOptions {
  enabledCategories: ChallengeCategory[];
  categoryScores: RollingScoreMap;
  /** Files asked about more than N days ago — eligible for a retention check. */
  staleSubjectFiles: Set<string>;
  /** When set, each (type, candidate) pair is tried via AI first, falling back to the deterministic template on any failure. */
  aiProvider?: AIProvider;
  /** Fingerprints of recently-asked (type, file, function) combos — avoided on a first pass so the same question doesn't repeat while other candidates exist. */
  recentFingerprints?: Set<string>;
}

interface CandidateFile {
  file: FileContext;
  fn?: import('../context/CodeContextExtractor').FunctionInfo;
  testFile?: FileContext;
  commitMessage: string | null;
}

export class QuestionEngine {
  constructor(private readonly workspaceFolder: vscode.WorkspaceFolder) {}

  async generateChallenge(options: GenerateChallengeOptions): Promise<GeneratedQuestion | undefined> {
    const root = this.workspaceFolder.uri.fsPath;
    const candidates = await this.buildCandidateFiles(root);
    if (candidates.length === 0) {
      getLogger().info('No usable context for a challenge — skipping');
      return undefined;
    }

    const categoryOrder = weightedCategoryOrder(options.enabledCategories, options.categoryScores);

    // First pass avoids repeating anything asked recently, so variety comes
    // from trying other categories/types/files first. If that leaves
    // nothing (e.g. only one file/function is actually being worked on),
    // a second pass allows repeats rather than silently skipping the
    // challenge — a repeat is better than nothing firing at all.
    const firstPass = await this.tryAllCombos(candidates, categoryOrder, options, options.recentFingerprints);
    if (firstPass) return firstPass;
    if (options.recentFingerprints && options.recentFingerprints.size > 0) {
      const secondPass = await this.tryAllCombos(candidates, categoryOrder, options, undefined);
      if (secondPass) return secondPass;
    }

    getLogger().info('No template produced a confident question — skipping challenge');
    return undefined;
  }

  private async tryAllCombos(
    candidates: CandidateFile[],
    categoryOrder: ChallengeCategory[],
    options: GenerateChallengeOptions,
    skipFingerprints: Set<string> | undefined,
  ): Promise<GeneratedQuestion | undefined> {
    for (const category of categoryOrder) {
      const types = ALL_QUESTION_TYPES.filter((t) => QUESTION_TYPE_TO_CATEGORY[t] === category);
      // ChallengeCategory's values are a subset of ScoreCategory's (everything but "retention").
      const difficulty = pickDifficulty(category as unknown as ScoreCategory, options.categoryScores);

      for (const type of types) {
        for (const candidate of candidates) {
          if (skipFingerprints) {
            const fingerprint = questionFingerprint(type, candidate.file.relativePath, candidate.fn?.name);
            if (skipFingerprints.has(fingerprint)) continue;
          }

          const isRetentionCheck = options.staleSubjectFiles.has(candidate.file.relativePath);

          if (options.aiProvider) {
            const aiQuestion = await tryGenerateAIQuestion(
              options.aiProvider,
              category,
              type,
              difficulty,
              candidate,
              isRetentionCheck,
            );
            if (aiQuestion) return aiQuestion;
          }

          const ctx: TemplateContext = {
            file: candidate.file,
            fn: candidate.fn,
            testFile: candidate.testFile,
            commitMessage: candidate.commitMessage,
            now: Date.now(),
            isRetentionCheck,
          };
          const question = generateQuestion(type, ctx);
          if (question) return question;
        }
      }
    }
    return undefined;
  }

  private async buildCandidateFiles(root: string): Promise<CandidateFile[]> {
    const git = await analyzeGit(root);
    const results: CandidateFile[] = [];

    if (git.available && git.changedFiles.length > 0) {
      const changedLines = parseChangedLines(git.diff);
      for (const relPath of git.changedFiles.slice(0, 8)) {
        const text = safeRead(path.join(root, relPath));
        if (!text) continue;
        const fileContext: FileContext = { relativePath: relPath, text };
        const functions = extractFunctions(text, relPath);
        const lines = changedLines.get(relPath);
        const fn = lines ? findFunctionTouchedByLines(functions, lines) : functions[0];
        const testFile = this.findTestFile(root, relPath, git.changedFiles);

        results.push({ file: fileContext, fn, testFile, commitMessage: git.lastCommitMessage });
      }
    }

    if (results.length === 0) {
      const recent = await findRecentlyModifiedFiles(this.workspaceFolder);
      for (const r of recent.slice(0, 8)) {
        const text = safeRead(r.uri.fsPath);
        if (!text) continue;
        const fileContext: FileContext = { relativePath: r.relativePath, text };
        const functions = extractFunctions(text, r.relativePath);
        results.push({
          file: fileContext,
          fn: functions[0],
          commitMessage: git.available ? git.lastCommitMessage : null,
        });
      }
    }

    return results;
  }

  private findTestFile(root: string, sourceRelPath: string, changedFiles: string[]): FileContext | undefined {
    const base = path.basename(sourceRelPath).replace(/\.[^.]+$/, '');
    const testCandidate = changedFiles.find(
      (f) => f !== sourceRelPath && f.includes(base) && /\.(test|spec)\./.test(f),
    );
    if (!testCandidate) return undefined;
    const text = safeRead(path.join(root, testCandidate));
    return text ? { relativePath: testCandidate, text } : undefined;
  }
}

function safeRead(filePath: string): string | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size > MAX_FILE_READ_BYTES) return undefined;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Weighted-random ordering of enabled categories, weighted toward
 * categories with lower rolling scores (spec section 31: use challenges to
 * improve weak areas, not just what the user is already good at).
 */
function weightedCategoryOrder(
  enabled: ChallengeCategory[],
  scores: RollingScoreMap,
): ChallengeCategory[] {
  const pool = enabled.map((category) => {
    // ChallengeCategory's literal values are a subset of ScoreCategory's
    // (everything except "retention"), so this is a direct 1:1 lookup.
    const rolling = scores[category as unknown as ScoreCategory];
    const weight = rolling && rolling.sampleCount > 0 ? Math.max(5, 100 - rolling.value) : 50;
    return { category, weight };
  });

  const order: ChallengeCategory[] = [];
  const remaining = [...pool];
  while (remaining.length > 0) {
    const total = remaining.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * total;
    let pickIndex = 0;
    for (let i = 0; i < remaining.length; i++) {
      roll -= remaining[i].weight;
      if (roll <= 0) {
        pickIndex = i;
        break;
      }
    }
    order.push(remaining[pickIndex].category);
    remaining.splice(pickIndex, 1);
  }
  return order;
}
