import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StorageManager } from './storage/StorageManager';
import { extractFunctions } from './context/CodeContextExtractor';
import { SessionManager } from './session/SessionManager';
import { resolveIntervalMs } from './session/resolveIntervalMs';
import { QuestionEngine } from './questions/QuestionEngine';
import { questionFingerprint } from './questions/questionFingerprint';
import { DeterministicEvaluator, isShallowFreeTextAnswer, type Evaluator } from './scoring/Evaluator';
import { HybridEvaluator } from './scoring/HybridEvaluator';
import { updateRollingScore, computeAura } from './scoring/ScoreEngine';
import { recordChallengeCompletion, applyStreakDecay } from './scoring/StreakEngine';
import { evaluateBadges } from './badges/BadgeEngine';
import { tryGenerateAIQuestion } from './questions/AIQuestionGenerator';
import { QUESTION_TYPE_TO_SCORE_CATEGORY, type ChallengeCategory, type ChallengeAnswer, type ChallengeRecord, type GeneratedQuestion } from './questions/QuestionTypes';
import type { CodoraSettings } from './storage/StorageSchema';
import { AIProviderResolver, type AIStatus } from './ai/AIProviderResolver';
import type { AIProvider } from './ai/AITypes';
import { getLogger } from '../utils/logger';

const STALE_SUBJECT_DAYS = 3;
const STALE_SUBJECT_MS = STALE_SUBJECT_DAYS * 24 * 60 * 60 * 1000;
/** How many of the most recent challenges to avoid exactly repeating. */
const RECENT_FINGERPRINT_WINDOW = 10;

export interface SubmitAnswerResult {
  evaluation: import('./scoring/ScoreTypes').EvaluationResult;
  auraDelta: number;
  followUp?: GeneratedQuestion;
}

/**
 * Central coordinator wiring storage, session tracking, question
 * generation, and scoring together. Providers (sidebar/dashboard/challenge
 * webviews) all go through this rather than touching storage directly, so
 * there is exactly one place that knows how to update scores/streaks/badges.
 */
export class CodoraController implements vscode.Disposable {
  readonly storage: StorageManager;
  readonly aiResolver: AIProviderResolver;
  private readonly sessionManager: SessionManager;
  private readonly questionEngine: QuestionEngine;
  private readonly deterministicEvaluator = new DeterministicEvaluator();
  private readonly evaluator: Evaluator;
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeState = this.changeEmitter.event;

  private pendingQuestion: GeneratedQuestion | null = null;
  /** AI providers (if any) resolved for the in-flight challenge, in priority order, reused for its evaluation. */
  private activeAIProviders: AIProvider[] = [];
  /** Shown once per session: "no AI provider was even tried, and here's why" — the silent version of this was impossible to distinguish from "AI tried and failed". */
  private hasWarnedNoProviders = false;

  constructor(
    context: vscode.ExtensionContext,
    private readonly workspaceFolder: vscode.WorkspaceFolder,
    onChallengeReady: () => void,
  ) {
    const projectId = sanitizeId(workspaceFolder.uri.fsPath);
    this.storage = new StorageManager(context, projectId, workspaceFolder.name);
    this.aiResolver = new AIProviderResolver(context.secrets, this.storage);
    this.questionEngine = new QuestionEngine(workspaceFolder);
    this.evaluator = new HybridEvaluator(this.deterministicEvaluator, () => this.activeAIProviders);
    this.sessionManager = new SessionManager(workspaceFolder, {
      onChallengeReady,
      getChallengeIntervalMs: () => resolveIntervalMs(this.storage.getGlobalProfile().settings),
      isPaused: () => this.isPaused(),
    });
  }

  start(): void {
    this.sessionManager.start();
  }

  dispose(): void {
    this.sessionManager.dispose();
    this.changeEmitter.dispose();
  }

  isPaused(): boolean {
    const until = this.storage.getGlobalProfile().challengesPausedUntil;
    return until !== null && until > Date.now();
  }

  async pauseChallenges(): Promise<void> {
    await this.storage.updateGlobalProfile((p) => ({ ...p, challengesPausedUntil: Number.MAX_SAFE_INTEGER }));
    this.emitChange();
  }

  async resumeChallenges(): Promise<void> {
    await this.storage.updateGlobalProfile((p) => ({ ...p, challengesPausedUntil: null }));
    this.emitChange();
  }

  async updateSettings(patch: Partial<CodoraSettings>): Promise<void> {
    await this.storage.updateGlobalProfile((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
    this.emitChange();
  }

  async resetProjectData(): Promise<void> {
    await this.storage.resetProjectData();
    this.emitChange();
  }

  async generateChallenge(): Promise<GeneratedQuestion | undefined> {
    const global = this.storage.getGlobalProfile();
    const project = this.storage.getProjectData();
    const enabledCategories = global.settings.categories as ChallengeCategory[];
    const staleSubjectFiles = this.computeStaleSubjectFiles(project.challenges);
    const recentFingerprints = this.computeRecentFingerprints(project.challenges);

    // Resolved once per challenge (may prompt the user to configure an AI
    // provider) and reused for this same challenge's evaluation — this is
    // always reached via a command or a "Take Challenge" click, so it's a
    // valid place for the Language Model API's own consent flow to fire.
    // Every configured provider is tried in priority order, not just the
    // first one that's merely *available* — see AIProviderResolver.
    this.activeAIProviders = await this.aiResolver.resolveCandidatesOrPrompt();
    getLogger().info('AI providers resolved for this challenge', {
      count: this.activeAIProviders.length,
      providers: this.activeAIProviders.map((p) => p.id),
      aiEnabledSetting: global.settings.ai.enabled,
      aiPromptDismissed: global.aiPromptDismissed,
    });
    if (this.activeAIProviders.length === 0) {
      let reason: string;
      if (!global.settings.ai.enabled) {
        reason = 'AI is turned off (Dashboard → Settings → "Allow Codora to use an AI model" is unchecked)';
      } else if (global.aiPromptDismissed) {
        reason = 'nothing is configured, and the one-time setup prompt was previously dismissed';
      } else {
        reason = 'nothing is configured and nothing is available via VS Code';
      }
      getLogger().warn(`No AI provider will be tried this challenge: ${reason}`);
      if (!this.hasWarnedNoProviders) {
        this.hasWarnedNoProviders = true;
        void vscode.window.showWarningMessage(
          `Codora: every challenge is using local templates because ${reason}. Run "Codora: Configure AI Provider" to fix this.`,
        );
      }
    }

    const question = await this.questionEngine.generateChallenge({
      enabledCategories,
      categoryScores: global.categoryScores,
      staleSubjectFiles,
      recentFingerprints,
      aiProviders: this.activeAIProviders,
    });

    this.pendingQuestion = question ?? null;
    if (!question) {
      getLogger().info('Challenge skipped: no confident question available');
    }
    return question;
  }

  getPendingQuestion(): GeneratedQuestion | null {
    return this.pendingQuestion;
  }

  async getAIStatus(): Promise<AIStatus> {
    return this.aiResolver.getStatus();
  }

  async configureAI(): Promise<void> {
    await this.aiResolver.configureInteractively();
    this.emitChange();
  }

  async disableAI(): Promise<void> {
    await this.updateSettings({ ai: { ...this.storage.getGlobalProfile().settings.ai, enabled: false } });
  }

  async submitAnswer(answer: ChallengeAnswer): Promise<SubmitAnswerResult> {
    const question = this.pendingQuestion;
    if (!question || question.id !== answer.questionId) {
      throw new Error('No matching pending question for this answer');
    }

    const evaluation = await this.evaluator.evaluate(question, answer);
    const now = Date.now();
    const scoreCategory = QUESTION_TYPE_TO_SCORE_CATEGORY[question.type];

    const globalBefore = this.storage.getGlobalProfile();
    const auraBefore = computeAura(globalBefore.categoryScores);

    const record: ChallengeRecord = { question, answer, evaluation };

    await this.storage.updateProjectData((project) => ({
      ...project,
      challenges: [...project.challenges, record],
      categoryScores: updateRollingScore(project.categoryScores, scoreCategory, evaluation.score, now),
      auraHistory: appendAuraSnapshot(project.auraHistory, computeAura(project.categoryScores), now),
    }));

    const global = await this.storage.updateGlobalProfile((profile) => {
      const decayedStreak = applyStreakDecay(profile.streak, now);
      const streak = evaluation.correct ? recordChallengeCompletion(decayedStreak, now) : decayedStreak;
      const categoryScores = updateRollingScore(profile.categoryScores, scoreCategory, evaluation.score, now);
      const auraHistory = appendAuraSnapshot(profile.auraHistory, computeAura(categoryScores), now);
      return { ...profile, streak, categoryScores, auraHistory };
    });

    const allChallenges = this.storage.getProjectData().challenges;
    const newBadges = evaluateBadges(global, allChallenges, now);
    if (newBadges.length > 0) {
      await this.storage.updateGlobalProfile((p) => ({ ...p, badges: [...p.badges, ...newBadges] }));
    }

    const auraAfter = computeAura(this.storage.getGlobalProfile().categoryScores);
    const auraDelta = auraAfter - auraBefore;

    let followUp: GeneratedQuestion | undefined;
    if (!question.followUpToChallengeId && isShallowFreeTextAnswer(question, answer)) {
      followUp = await this.tryGenerateFollowUp(question);
    }
    this.pendingQuestion = followUp ?? null;

    this.emitChange();
    return { evaluation, auraDelta, followUp };
  }

  /**
   * A follow-up (spec section 20): probe the same function again so a
   * shallow free-text description doesn't score the same as real
   * understanding. Uses the same AI providers as the original question and
   * simply skips when none can produce one — there's no template fallback.
   */
  private async tryGenerateFollowUp(question: GeneratedQuestion): Promise<GeneratedQuestion | undefined> {
    const relPath = question.provenance.sourceFiles[0];
    const fnName = question.provenance.subjectFunction;
    if (!relPath || this.activeAIProviders.length === 0) return undefined;

    const fullPath = path.join(this.workspaceFolder.uri.fsPath, relPath);
    let text: string;
    try {
      text = fs.readFileSync(fullPath, 'utf8');
    } catch {
      return undefined;
    }

    const fn = fnName ? extractFunctions(text, relPath).find((f) => f.name === fnName) : undefined;
    const candidate = { file: { relativePath: relPath, text }, fn, commitMessage: null };

    for (const provider of this.activeAIProviders) {
      const followUp = await tryGenerateAIQuestion(
        provider,
        'reasoning',
        'prediction',
        question.difficulty,
        candidate,
        false,
      );
      if (followUp) return { ...followUp, followUpToChallengeId: question.id };
    }
    return undefined;
  }

  private computeStaleSubjectFiles(challenges: ChallengeRecord[]): Set<string> {
    const now = Date.now();
    const lastSeen = new Map<string, number>();
    for (const c of challenges) {
      for (const file of c.question.provenance.sourceFiles) {
        lastSeen.set(file, Math.max(lastSeen.get(file) ?? 0, c.answer.answeredAt));
      }
    }
    const stale = new Set<string>();
    for (const [file, ts] of lastSeen) {
      if (now - ts >= STALE_SUBJECT_MS) stale.add(file);
    }
    return stale;
  }

  private computeRecentFingerprints(challenges: ChallengeRecord[]): Set<string> {
    const recent = challenges.slice(-RECENT_FINGERPRINT_WINDOW);
    return new Set(
      recent.map((c) =>
        questionFingerprint(c.question.type, c.question.provenance.sourceFiles[0] ?? '', c.question.provenance.subjectFunction),
      ),
    );
  }

  private emitChange(): void {
    this.changeEmitter.fire();
  }
}

function appendAuraSnapshot(
  history: { date: string; value: number }[],
  value: number,
  now: number,
): { date: string; value: number }[] {
  const date = new Date(now).toISOString().slice(0, 10);
  const existingIndex = history.findIndex((h) => h.date === date);
  if (existingIndex >= 0) {
    const next = [...history];
    next[existingIndex] = { date, value };
    return next;
  }
  return [...history, { date, value }].slice(-90);
}

function sanitizeId(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '_').slice(-120);
}
