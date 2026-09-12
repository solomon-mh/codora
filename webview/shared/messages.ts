import type { GeneratedQuestion, ChallengeAnswer } from '../../src/core/questions/QuestionTypes';
import type { EvaluationResult, ScoreCategory } from '../../src/core/scoring/ScoreTypes';
import type { CodoraSettings } from '../../src/core/storage/StorageSchema';

export interface CategoryBreakdownItem {
  category: ScoreCategory;
  label: string;
  value: number;
  sampleCount: number;
}

export interface HistoryItem {
  questionId: string;
  correct: boolean;
  category: string;
  difficulty: string;
  timestampLabel: string;
  prompt: string;
  scorePct: number;
  sourceFiles: string[];
  answerText?: string;
  feedback: string;
  strengths: string[];
  gaps: string[];
}

export interface BadgeItem {
  id: string;
  label: string;
  earned: boolean;
  earnedAt?: number;
}

export interface SidebarState {
  hasEnoughData: boolean;
  aura: number | null;
  auraLabel: string;
  streakCurrent: number;
  projectName: string;
  breakdown: CategoryBreakdownItem[];
  challengesPaused: boolean;
  insightHint: string;
}

export interface DashboardState {
  hasEnoughData: boolean;
  globalAura: number | null;
  projectAura: number | null;
  auraLabel: string;
  auraDeltaThisWeek: number | null;
  breakdown: CategoryBreakdownItem[];
  thisWeek: {
    codingSessions: number;
    challengesCompleted: number;
    correctAnswers: number;
    accuracyPct: number | null;
    currentStreak: number;
    bestStreak: number;
    dailyChallengeCounts: { day: string; count: number }[];
  };
  insights: string[];
  project: {
    name: string;
    aura: number | null;
    challenges: number;
    strongCategories: string[];
    weakCategories: string[];
  };
  history: HistoryItem[];
  badges: BadgeItem[];
  settings: CodoraSettings;
}

export type SidebarToExtensionMessage =
  | { type: 'ready' }
  | { type: 'openDashboard' }
  | { type: 'startChallenge' };

export type ExtensionToSidebarMessage = { type: 'state'; payload: SidebarState };

export type DashboardToExtensionMessage =
  | { type: 'ready' }
  | { type: 'startChallenge' }
  | { type: 'resetProjectData' }
  | { type: 'updateSettings'; payload: Partial<CodoraSettings> };

export type ExtensionToDashboardMessage = { type: 'state'; payload: DashboardState };

export type ChallengeToExtensionMessage =
  | { type: 'ready' }
  | { type: 'submitAnswer'; payload: ChallengeAnswer }
  | { type: 'close' };

export type ExtensionToChallengeMessage =
  | { type: 'question'; payload: GeneratedQuestion }
  | {
      type: 'result';
      payload: {
        evaluation: EvaluationResult;
        auraDelta: number;
        correctOptionText?: string;
      };
    }
  | { type: 'followUp'; payload: GeneratedQuestion };

export type OnboardingToExtensionMessage = {
  type: 'complete';
  payload: { challengeInterval: CodoraSettings['challengeInterval']; categories: string[] };
};

export type ExtensionToOnboardingMessage = { type: 'init' };
