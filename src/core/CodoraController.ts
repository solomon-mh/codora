import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StorageManager } from './storage/StorageManager';
import { extractFunctions } from './context/CodeContextExtractor';
import { SessionManager } from './session/SessionManager';
import { QuestionEngine } from './questions/QuestionEngine';
import { DeterministicEvaluator, isShallowFreeTextAnswer, type Evaluator } from './scoring/Evaluator';
import { HybridEvaluator } from './scoring/HybridEvaluator';
import { updateRollingScore, computeAura } from './scoring/ScoreEngine';
import { recordChallengeCompletion, applyStreakDecay } from './scoring/StreakEngine';
import { evaluateBadges } from './badges/BadgeEngine';
import { generateQuestion } from './questions/QuestionGenerator';
import { QUESTION_TYPE_TO_SCORE_CATEGORY, type ChallengeCategory, type ChallengeAnswer, type ChallengeRecord, type GeneratedQuestion } from './questions/QuestionTypes';
import type { CodoraSettings } from './storage/StorageSchema';
import { AIProviderResolver, type AIStatus } from './ai/AIProviderResolver';
import type { AIProvider } from './ai/AITypes';
import { getLogger } from '../utils/logger';

const STALE_SUBJECT_DAYS = 3;
const STALE_SUBJECT_MS = STALE_SUBJECT_DAYS * 24 * 60 * 60 * 1000;

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
  /** The AI provider (if any) resolved for the in-flight challenge, reused for its evaluation. */
  private activeAIProvider: AIProvider | undefined;

  constructor(
    context: vscode.ExtensionContext,
    private readonly workspaceFolder: vscode.WorkspaceFolder,
    onChallengeReady: () => void,
  ) {
    const projectId = sanitizeId(workspaceFolder.uri.fsPath);
    this.storage = new StorageManager(context, projectId, workspaceFolder.name);
    this.aiResolver = new AIProviderResolver(context.secrets, this.storage);
    this.questionEngine = new QuestionEngine(workspaceFolder);
    this.evaluator = new HybridEvaluator(this.deterministicEvaluator, () => this.activeAIProvider);
    this.sessionManager = new SessionManager(workspaceFolder, {
      onChallengeReady,
      getChallengeInterval: () => this.storage.getGlobalProfile().settings.challengeInterval,
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

    // Resolved once per challenge (may prompt the user to configure an AI
    // provider) and reused for this same challenge's evaluation — this is
    // always reached via a command or a "Take Challenge" click, so it's a
    // valid place for the Language Model API's own consent flow to fire.
    this.activeAIProvider = await this.aiResolver.resolveOrPrompt();

    const question = await this.questionEngine.generateChallenge({
      enabledCategories,
      categoryScores: global.categoryScores,
      staleSubjectFiles,
      aiProvider: this.activeAIProvider,
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
      followUp = this.tryGenerateFollowUp(question);
    }
    this.pendingQuestion = followUp ?? null;

    this.emitChange();
    return { evaluation, auraDelta, followUp };
  }

  private tryGenerateFollowUp(question: GeneratedQuestion): GeneratedQuestion | undefined {
    // A basic follow-up (spec section 20): re-ask a "prediction" question
    // about the same function so a shallow free-text description doesn't
    // score the same as real understanding. Only fires when the subject
    // function can be re-read and re-analyzed for real guard-clause facts
    // — same "skip rather than guess" rule as every other template.
    const relPath = question.provenance.sourceFiles[0];
    const fnName = question.provenance.subjectFunction;
    if (!relPath || !fnName) return undefined;

    const fullPath = path.join(this.workspaceFolder.uri.fsPath, relPath);
    let text: string;
    try {
      text = fs.readFileSync(fullPath, 'utf8');
    } catch {
      return undefined;
    }

    const fn = extractFunctions(text, relPath).find((f) => f.name === fnName);
    if (!fn) return undefined;

    const followUp = generateQuestion('prediction', {
      file: { relativePath: relPath, text },
      fn,
      commitMessage: null,
      now: Date.now(),
      isRetentionCheck: false,
    });

    return followUp ? { ...followUp, followUpToChallengeId: question.id } : undefined;
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
