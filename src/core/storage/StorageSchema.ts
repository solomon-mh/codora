import type { RollingScoreMap } from '../scoring/ScoreTypes';
import type { ChallengeRecord } from '../questions/QuestionTypes';
import type { SessionRecord } from '../session/SessionState';

export const SCHEMA_VERSION = 1;

export type ChallengeInterval = '10min' | '30min' | '1hour' | 'custom' | 'adaptive' | 'off';
export type DifficultySetting = 'adaptive' | 'easy' | 'medium' | 'hard';
export type AnthropicModel = 'claude-haiku-4-5' | 'claude-sonnet-5' | 'claude-opus-5';
export type OpenAIModel = 'gpt-4o-mini' | 'gpt-4o';
/**
 * Gemini's 2.x flash models return 404 "no longer available to new users"
 * for newly issued API keys; Google's own error response recommends
 * gemini-3.6-flash, which is why that's the default here.
 */
export type GeminiModel = 'gemini-3.6-flash' | 'gemini-3.8-flash' | 'gemini-3.1-flash-lite';

/**
 * The currently-valid values for each model setting. Providers retire
 * model ids over time, and a retired id persisted in stored settings would
 * otherwise keep 404-ing forever with no way to self-heal — so
 * StorageManager validates stored values against these and falls back to
 * the default when a stored id is no longer one of them.
 */
export const VALID_ANTHROPIC_MODELS: readonly AnthropicModel[] = [
  'claude-haiku-4-5',
  'claude-sonnet-5',
  'claude-opus-5',
];
export const VALID_OPENAI_MODELS: readonly OpenAIModel[] = ['gpt-4o-mini', 'gpt-4o'];
export const VALID_GEMINI_MODELS: readonly GeminiModel[] = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

export interface CodoraSettings {
  challengeInterval: ChallengeInterval;
  /** Minutes between challenges when challengeInterval is 'custom'. */
  customIntervalMinutes: number;
  difficulty: DifficultySetting;
  categories: string[];
  notifications: {
    challenge: boolean;
    dailyProgress: boolean;
    weeklySummary: boolean;
  };
  avoidInterrupting: {
    debugging: boolean;
    testsRunning: boolean;
    gitOperations: boolean;
  };
  doNotDisturb: boolean;
  ai: {
    /** When false, Codora never attempts an AI call and never prompts to configure one. */
    enabled: boolean;
    /** Model for the manual Anthropic API key fallback (only used when no VS Code Language Model is available). */
    anthropicModel: AnthropicModel;
    /** Model for the manual OpenAI API key fallback (only used when no VS Code Language Model is available). */
    openAIModel: OpenAIModel;
    /** Model for the manual Gemini API key fallback (only used when no VS Code Language Model is available). */
    geminiModel: GeminiModel;
  };
}

export interface StreakState {
  current: number;
  longest: number;
  /** ISO date (yyyy-mm-dd) of the last day with a completed challenge. */
  lastActiveDate: string | null;
  daysActive: number;
}

export interface BadgeState {
  id: string;
  earnedAt: number;
}

/** Global, cross-project profile (spec sections 21-25, 30). */
export interface GlobalProfile {
  schemaVersion: number;
  onboarded: boolean;
  settings: CodoraSettings;
  categoryScores: RollingScoreMap;
  streak: StreakState;
  badges: BadgeState[];
  auraHistory: { date: string; value: number }[];
  challengesPausedUntil: number | null;
  /** True once the user has dismissed the "configure an AI provider" prompt, so Codora stops asking. */
  aiPromptDismissed: boolean;
}

/** Per-workspace project data (spec sections 26-27, 30). */
export interface ProjectData {
  schemaVersion: number;
  projectId: string;
  projectName: string;
  sessions: SessionRecord[];
  challenges: ChallengeRecord[];
  categoryScores: RollingScoreMap;
  auraHistory: { date: string; value: number }[];
}

export function defaultSettings(): CodoraSettings {
  return {
    challengeInterval: '30min',
    customIntervalMinutes: 30,
    difficulty: 'adaptive',
    categories: ['recall', 'reasoning', 'debugging', 'architecture', 'testing', 'security', 'performance'],
    notifications: { challenge: true, dailyProgress: true, weeklySummary: true },
    avoidInterrupting: { debugging: true, testsRunning: true, gitOperations: true },
    doNotDisturb: false,
    ai: { enabled: true, anthropicModel: 'claude-haiku-4-5', openAIModel: 'gpt-4o-mini', geminiModel: 'gemini-3.6-flash' },
  };
}
