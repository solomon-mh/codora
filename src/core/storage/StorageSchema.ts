import type { RollingScoreMap } from '../scoring/ScoreTypes';
import type { ChallengeRecord } from '../questions/QuestionTypes';
import type { SessionRecord } from '../session/SessionState';

export const SCHEMA_VERSION = 1;

export type ChallengeInterval = '10min' | '30min' | '1hour' | 'adaptive' | 'off';
export type DifficultySetting = 'adaptive' | 'easy' | 'medium' | 'hard';

export interface CodoraSettings {
  challengeInterval: ChallengeInterval;
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
    difficulty: 'adaptive',
    categories: ['recall', 'reasoning', 'debugging', 'architecture', 'testing', 'security', 'performance'],
    notifications: { challenge: true, dailyProgress: true, weeklySummary: true },
    avoidInterrupting: { debugging: true, testsRunning: true, gitOperations: true },
    doNotDisturb: false,
  };
}
