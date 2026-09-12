import type { RollingScoreMap } from '../scoring/ScoreTypes';
import type { ChallengeRecord } from '../questions/QuestionTypes';
import type { SessionRecord } from '../session/SessionState';

export const SCHEMA_VERSION = 1;

export type ChallengeInterval = '10min' | '30min' | '1hour' | 'custom' | 'adaptive' | 'off';
export type DifficultySetting = 'adaptive' | 'easy' | 'medium' | 'hard';
export type AnthropicModel = 'claude-haiku-4-5' | 'claude-sonnet-5' | 'claude-opus-5';
export type OpenAIModel = 'gpt-4o-mini' | 'gpt-4o';

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
    ai: { enabled: true, anthropicModel: 'claude-haiku-4-5', openAIModel: 'gpt-4o-mini' },
  };
}
