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
import { applyAnswer, auraChange, computeAura, replayRollingScores } from './scoring/ScoreEngine';
import { recordChallengeCompletion, applyStreakDecay } from './scoring/StreakEngine';
import { evaluateBadges } from './badges/BadgeEngine';
import { tryGenerateAIQuestion } from './questions/AIQuestionGenerator';
import type { ChallengeCategory, ChallengeAnswer, ChallengeRecord, FlagReason, GeneratedQuestion } from './questions/QuestionTypes';
import { dueForReview } from './questions/retention';
import { Metrics, scoreBucket, secondsBucket } from './metrics/Metrics';
import type { CodoraSettings } from './storage/StorageSchema';
import { AIProviderResolver, type AIStatus } from './ai/AIProviderResolver';
import type { AIProvider } from './ai/AITypes';
import { getLogger } from '../utils/logger';

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
  /** Per-provider failure reasons from the most recent generateChallenge(), surfaced in the challenge panel. */
  private lastAIFailures: { provider: string; reason?: string }[] = [];
  /** The latest answer and the global scores just before it, so reporting that question can take its score back out. */
  private lastSubmission: { questionId: string; globalScoresBefore: import('./scoring/ScoreTypes').RollingScoreMap } | null = null;
  readonly metrics: Metrics;

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
    this.metrics = new Metrics(
      context.globalState,
      () => this.storage.getGlobalProfile().settings.metrics.enabled,
      String(context.extension.packageJSON.version ?? '0.0.0'),
    );
    this.sessionManager = new SessionManager(workspaceFolder, {
      onChallengeReady,
      getChallengeIntervalMs: () => resolveIntervalMs(this.storage.getGlobalProfile().settings),
      isPaused: () => this.isPaused(),
    });
  }

  start(): void {
    this.sessionManager.start();
    // Counts active installs (daily/weekly actives, week-1 retention). Dropped unless opted in.
    this.metrics.track({ name: 'activated' });
  }

  dispose(): void {
    this.sessionManager.dispose();
    this.metrics.dispose();
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
    if (patch.metrics) await this.metrics.setOptedIn(patch.metrics.enabled);
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
    const reviewDue = dueForReview(project.challenges, Date.now());
    // At most every other challenge is a review, so new code still gets asked about.
    const preferReview = reviewDue.length > 0 && project.challenges.at(-1)?.question.isRetentionCheck !== true;
    const recentFingerprints = this.computeRecentFingerprints(project.challenges);
    for (const flag of project.flags) recentFingerprints.add(flag.fingerprint);

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
      // The challenge panel reports this to the user (see
      // ChallengeProvider.describeUnavailable) — logged here so the precise
      // cause is still recoverable from the output channel.
      let reason: string;
      if (!global.settings.ai.enabled) {
        reason = 'AI is turned off (Dashboard → Settings → "Allow Codora to use an AI model" is unchecked)';
      } else if (global.aiPromptDismissed) {
        reason = 'nothing is configured, and the one-time setup prompt was previously dismissed';
      } else {
        reason = 'nothing is configured and nothing is available via VS Code';
      }
      getLogger().warn(`No AI provider will be tried this challenge: ${reason}`);
      this.metrics.track({ name: 'no_question', reason: 'no_provider' });
    }

    // Reset per challenge: these are the reasons *this* attempt failed, and
    // they're what the panel shows instead of a generic guess.
    this.lastAIFailures = [];
    const question = await this.questionEngine.generateChallenge({
      enabledCategories,
      categoryScores: global.categoryScores,
      reviewDue,
      preferReview,
      recentFingerprints,
      aiProviders: this.activeAIProviders,
      onProviderFailure: (provider, reason) => this.lastAIFailures.push({ provider, reason }),
      onQuestionRejected: (verdict) => this.metrics.track({ name: 'question_rejected', verdict }),
    });

    this.pendingQuestion = question ?? null;
    if (!question) {
      getLogger().info('Challenge skipped: no AI provider produced a question');
      if (this.activeAIProviders.length > 0) this.metrics.track({ name: 'no_question', reason: 'all_failed' });
    }
    return question;
  }

  /** Why each provider failed during the most recent generateChallenge(), for the UI to report verbatim. */
  getLastAIFailures(): ReadonlyArray<{ provider: string; reason?: string }> {
    return this.lastAIFailures;
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

    const globalBefore = this.storage.getGlobalProfile();

    const record: ChallengeRecord = { question, answer, evaluation };

    await this.storage.updateProjectData((project) => {
      // Snapshot the scores *after* this answer lands. Computing the aura from
      // project.categoryScores here would read the pre-update map and leave the
      // project's history permanently one answer behind.
      const categoryScores = applyAnswer(project.categoryScores, question, evaluation.score, now);
      return {
        ...project,
        challenges: [...project.challenges, record],
        categoryScores,
        auraHistory: appendAuraSnapshot(project.auraHistory, computeAura(categoryScores), now),
      };
    });

    const global = await this.storage.updateGlobalProfile((profile) => {
      const decayedStreak = applyStreakDecay(profile.streak, now);
      const streak = evaluation.correct ? recordChallengeCompletion(decayedStreak, now) : decayedStreak;
      const categoryScores = applyAnswer(profile.categoryScores, question, evaluation.score, now);
      const auraHistory = appendAuraSnapshot(profile.auraHistory, computeAura(categoryScores), now);
      return { ...profile, streak, categoryScores, auraHistory };
    });

    const allChallenges = this.storage.getProjectData().challenges;
    const newBadges = evaluateBadges(global, allChallenges, now);
    if (newBadges.length > 0) {
      await this.storage.updateGlobalProfile((p) => ({ ...p, badges: [...p.badges, ...newBadges] }));
    }

    const auraDelta = auraChange(globalBefore.categoryScores, this.storage.getGlobalProfile().categoryScores);
    this.lastSubmission = { questionId: question.id, globalScoresBefore: globalBefore.categoryScores };
    this.metrics.track({
      name: 'answered',
      kind: question.body.kind,
      correct: evaluation.correct,
      scoreBucket: scoreBucket(evaluation.score),
      secondsBucket: secondsBucket(answer.timeTakenMs),
      review: question.isRetentionCheck,
    });
    void this.maybeAskToShareMetrics();

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


  /**
   * The developer reports a question. Before it's answered, it's set aside
   * and its subject avoided. After it's answered (the result screen), the
   * answer is taken back out of every score: the project's scores are
   * replayed without it, and the global scores return to what they were
   * just before it — only possible for the latest answer, which is the only
   * one the result screen can report.
   */
  async flagQuestion(questionId: string, reason: FlagReason): Promise<{ scoreReverted: boolean }> {
    const now = Date.now();
    const pending = this.pendingQuestion;
    if (pending && pending.id === questionId) {
      const fingerprint = questionFingerprint(pending.type, pending.provenance.sourceFiles[0] ?? '', pending.provenance.subjectFunction);
      await this.storage.updateProjectData((p) => ({ ...p, flags: [...p.flags, { fingerprint, reason, at: now }] }));
      this.pendingQuestion = null;
      this.metrics.track({ name: 'flagged', reason, answered: false });
      this.emitChange();
      return { scoreReverted: false };
    }

    const last = this.lastSubmission;
    if (!last || last.questionId !== questionId) return { scoreReverted: false };

    await this.storage.updateProjectData((p) => {
      const challenges = p.challenges.map((c) => (c.question.id === questionId ? { ...c, flagged: reason } : c));
      const categoryScores = replayRollingScores(challenges);
      return { ...p, challenges, categoryScores, auraHistory: appendAuraSnapshot(p.auraHistory, computeAura(categoryScores), now) };
    });
    await this.storage.updateGlobalProfile((p) => ({
      ...p,
      categoryScores: last.globalScoresBefore,
      auraHistory: appendAuraSnapshot(p.auraHistory, computeAura(last.globalScoresBefore), now),
    }));
    this.lastSubmission = null;
    this.metrics.track({ name: 'flagged', reason, answered: true });
    this.emitChange();
    return { scoreReverted: true };
  }

  /** Asks once, after the first answer — the earliest moment the question makes sense. */
  private async maybeAskToShareMetrics(): Promise<void> {
    const settings = this.storage.getGlobalProfile().settings;
    if (settings.metrics.prompted) return;
    await this.updateSettings({ metrics: { ...settings.metrics, prompted: true } });
    const choice = await vscode.window.showInformationMessage(
      'Help improve Codora? Share anonymous usage counts — never your code, file names, questions or answers. You can change this any time in Settings.',
      'Share anonymous counts',
      'No thanks',
    );
    if (choice === 'Share anonymous counts') {
      await this.updateSettings({ metrics: { enabled: true, prompted: true } });
    }
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
