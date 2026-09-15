import type { GeneratedQuestion, ChallengeAnswer } from '../../src/core/questions/QuestionTypes';
import type { AIModelIdentity } from '../../src/core/ai/AIIdentity';
import type { EvaluationResult, ScoreCategory } from '../../src/core/scoring/ScoreTypes';
import type { CodoraSettings } from '../../src/core/storage/StorageSchema';
import type { AIStatus } from '../../src/core/ai/AIProviderResolver';

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
  generatedBy: 'ai' | 'deterministic';
  /** Which model wrote the question — absent on records stored before Codora tracked it. */
  generator?: AIModelIdentity;
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
    /**
     * Scored per-category for THIS workspace. Distinct from the top-level
     * `breakdown`, which is global: the project view must not mix a project
     * aura with global category bars, or the two disagree on screen.
     */
    breakdown: CategoryBreakdownItem[];
    strongCategories: string[];
    weakCategories: string[];
  };
  history: HistoryItem[];
  badges: BadgeItem[];
  settings: CodoraSettings;
  aiStatus: AIStatus;
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
  | { type: 'updateSettings'; payload: Partial<CodoraSettings> }
  | { type: 'configureAI' };

export type ExtensionToDashboardMessage = { type: 'state'; payload: DashboardState };

/** What the challenge panel can ask the extension to do when it can't show a question. */
export type ChallengeUnavailableAction =
  | 'configure-ai'
  | 'open-settings'
  | 'show-logs'
  | 'setup-vscode-lm'
  | 'setup-anthropic'
  | 'setup-openai'
  | 'setup-gemini';

/** One provider the user can set up directly from the panel. */
export interface ChallengeSetupOption {
  label: string;
  hint: string;
  kind: ChallengeUnavailableAction;
  /** True when this provider already has a key stored — offering to replace it rather than add it. */
  alreadyConfigured?: boolean;
}

/**
 * Shown in the challenge panel in place of a question. Question generation
 * is AI-only, so "couldn't generate one" is a normal, explainable state
 * that belongs where the question would have been — with the actions that
 * fix it — rather than only as a toast the user can miss.
 *
 * `setupOptions` lets the panel offer each provider as its own button, so
 * configuring one is a single click instead of a command + quick-pick.
 * Key *entry* still happens in VS Code's native masked input box (see
 * AIProviderResolver.setUpProvider) — a secret never passes through the
 * webview.
 */
export interface ChallengeUnavailable {
  title: string;
  detail: string;
  action?: { label: string; kind: ChallengeUnavailableAction };
  setupOptions?: ChallengeSetupOption[];
}

export type ChallengeToExtensionMessage =
  | { type: 'ready' }
  | { type: 'submitAnswer'; payload: ChallengeAnswer }
  | { type: 'retry' }
  | { type: 'action'; payload: ChallengeUnavailableAction }
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
  | { type: 'followUp'; payload: GeneratedQuestion }
  | { type: 'unavailable'; payload: ChallengeUnavailable };

export type OnboardingToExtensionMessage = {
  type: 'complete';
  payload: { challengeInterval: CodoraSettings['challengeInterval']; categories: string[] };
};

export type ExtensionToOnboardingMessage = { type: 'init' };
