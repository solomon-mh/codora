import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeGit } from '../context/GitAnalyzer';
import { findRecentlyModifiedFiles } from '../context/WorkspaceAnalyzer';
import { extractFunctions, findFunctionTouchedByLines, parseChangedLines } from '../context/CodeContextExtractor';
import type { ChallengeCategory, FileContext, GeneratedQuestion } from './QuestionTypes';
import { ALL_QUESTION_TYPES, QUESTION_TYPE_TO_CATEGORY } from './QuestionTypes';
import type { RollingScoreMap, ScoreCategory } from '../scoring/ScoreTypes';
import { getLogger } from '../../utils/logger';
import { tryGenerateAIQuestion } from './AIQuestionGenerator';
import type { AIProvider } from '../ai/AITypes';
import { pickDifficulty } from './QuestionDifficulty';
import { questionFingerprint } from './questionFingerprint';
import { summarizeProviderError } from '../ai/summarizeProviderError';

const MAX_FILE_READ_BYTES = 200_000;
/** Real AI calls attempted per provider, per challenge, before moving to the next provider — bounded so a failing provider doesn't turn every challenge into dozens of sequential requests. A non-retryable error (bad key, exhausted quota, retired model) stops that provider immediately, well before this cap. */
const MAX_AI_ATTEMPTS_PER_PROVIDER = 3;

export interface GenerateChallengeOptions {
  enabledCategories: ChallengeCategory[];
  categoryScores: RollingScoreMap;
  /** Files asked about more than N days ago — eligible for a retention check. */
  staleSubjectFiles: Set<string>;
  /**
   * Tried in order — each gets its own bounded attempt budget
   * (MAX_AI_ATTEMPTS_PER_PROVIDER) across different categories/files
   * before moving to the next candidate. If none of them produces a
   * question, no challenge is offered at all: there is deliberately no
   * local-template fallback, so a challenge is always genuinely grounded
   * in a model's reading of the code rather than a canned phrasing.
   */
  aiProviders?: AIProvider[];
  /** Fingerprints of recently-asked (type, file, function) combos — avoided on a first pass so the same question doesn't repeat while other candidates exist. */
  recentFingerprints?: Set<string>;
  /** Called once per provider that couldn't produce a question, so the caller can report the real reason in the UI instead of guessing at it. */
  onProviderFailure?: (providerLabel: string, reason: string | undefined) => void;
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

    // Each configured provider gets a real, multi-attempt chance across
    // different categories/files before moving to the next one — a VS Code
    // Language Model can resolve successfully (a model handle exists) while
    // still never producing usable output, so a manually configured key
    // must still get its own real chance.
    //
    // First pass avoids anything asked recently so questions vary; if that
    // yields nothing, a second pass allows a repeat rather than offering no
    // challenge at all.
    for (const provider of options.aiProviders ?? []) {
      const fresh = await this.tryAI(provider, candidates, categoryOrder, options, options.recentFingerprints);
      if (fresh) return fresh;
    }
    if (options.recentFingerprints && options.recentFingerprints.size > 0) {
      for (const provider of options.aiProviders ?? []) {
        const repeat = await this.tryAI(provider, candidates, categoryOrder, options, undefined);
        if (repeat) return repeat;
      }
    }

    // Deliberately no local-template fallback: a challenge should always be
    // a model's actual reading of this code, not a canned phrasing dressed
    // up as comprehension. If no provider can produce one, no challenge is
    // offered and the caller explains why.
    getLogger().info('No AI provider produced a question — no challenge will be offered');
    return undefined;
  }

  private async tryAI(
    provider: AIProvider,
    candidates: CandidateFile[],
    categoryOrder: ChallengeCategory[],
    options: GenerateChallengeOptions,
    skipFingerprints: Set<string> | undefined,
  ): Promise<GeneratedQuestion | undefined> {
    let attempts = 0;
    let lastFailureReason: string | undefined;
    let giveUpOnProvider = false;

    for (const category of categoryOrder) {
      if (giveUpOnProvider) break;
      const types = ALL_QUESTION_TYPES.filter((t) => QUESTION_TYPE_TO_CATEGORY[t] === category);
      const difficulty = pickDifficulty(category as unknown as ScoreCategory, options.categoryScores);

      for (const type of types) {
        if (giveUpOnProvider) break;
        for (const candidate of candidates) {
          if (skipFingerprints?.has(questionFingerprint(type, candidate.file.relativePath, candidate.fn?.name))) {
            continue;
          }
          if (attempts >= MAX_AI_ATTEMPTS_PER_PROVIDER) {
            this.reportAIFailure(provider, lastFailureReason, options);
            return undefined;
          }
          attempts++;

          const isRetentionCheck = options.staleSubjectFiles.has(candidate.file.relativePath);
          const aiQuestion = await tryGenerateAIQuestion(
            provider,
            category,
            type,
            difficulty,
            candidate,
            isRetentionCheck,
            (reason, retryable) => {
              lastFailureReason = reason;
              // A bad key / exhausted quota / retired model fails
              // identically every time, and on a metered key each retry
              // burns quota for nothing — stop this provider immediately.
              if (!retryable) giveUpOnProvider = true;
            },
          );
          if (aiQuestion) return aiQuestion;
          if (giveUpOnProvider) break;
        }
      }
    }
    if (attempts > 0) this.reportAIFailure(provider, lastFailureReason, options);
    return undefined;
  }

  /**
   * Records why a provider couldn't produce a question, and hands the
   * reason to the caller so it can be shown in the challenge panel itself
   * rather than only as a toast the user can miss.
   */
  private reportAIFailure(
    provider: AIProvider,
    reason: string | undefined,
    options: GenerateChallengeOptions,
  ): void {
    // Summarized here too: the per-attempt log above already recorded this,
    // and repeating a 1.5KB JSON error verbatim made the channel unreadable.
    getLogger().warn('AI provider could not produce a usable question', {
      provider: provider.label,
      reason: summarizeProviderError(reason),
    });
    options.onProviderFailure?.(provider.label, reason);
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
