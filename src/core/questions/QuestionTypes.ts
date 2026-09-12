import type { ScoreCategory } from '../scoring/ScoreTypes';

/** The 8 question types from spec section 12 (A-H). */
export type QuestionType =
  | 'recall'
  | 'prediction'
  | 'cause'
  | 'debugging'
  | 'architecture'
  | 'testing'
  | 'security'
  | 'performance';

/** User-facing category toggle (spec section 28) — coarser than QuestionType. */
export type ChallengeCategory =
  | 'recall'
  | 'reasoning'
  | 'debugging'
  | 'architecture'
  | 'testing'
  | 'security'
  | 'performance';

export const QUESTION_TYPE_TO_CATEGORY: Record<QuestionType, ChallengeCategory> = {
  recall: 'recall',
  prediction: 'reasoning',
  cause: 'reasoning',
  debugging: 'debugging',
  architecture: 'architecture',
  testing: 'testing',
  security: 'security',
  performance: 'performance',
};

export const QUESTION_TYPE_TO_SCORE_CATEGORY: Record<QuestionType, ScoreCategory> = {
  recall: 'recall',
  prediction: 'reasoning',
  cause: 'reasoning',
  debugging: 'debugging',
  architecture: 'architecture',
  testing: 'testing',
  security: 'security',
  performance: 'performance',
};

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface MultipleChoiceQuestion {
  kind: 'multiple-choice';
  options: QuestionOption[];
  correctOptionId: string;
}

export interface FreeTextQuestion {
  kind: 'free-text';
  /** Keywords/phrases a good answer is expected to touch on. */
  rubricKeywords: string[];
  maxLength: number;
}

export type QuestionBody = MultipleChoiceQuestion | FreeTextQuestion;

/** Why this specific question exists (spec section 40). */
export interface QuestionProvenance {
  sourceFiles: string[];
  sourceType: 'git-diff' | 'recent-file' | 'test-file';
  reason: string;
  /** The function/class this question is about, when applicable — lets a follow-up re-target the same subject. */
  subjectFunction?: string;
  /** The exact code snippet shown to an AI provider when generating this question, reused for evaluation. */
  codeSnippet?: string;
}

export interface GeneratedQuestion {
  id: string;
  type: QuestionType;
  category: ChallengeCategory;
  difficulty: Difficulty;
  prompt: string;
  body: QuestionBody;
  provenance: QuestionProvenance;
  /** True if this re-probes a file/topic asked about previously (spec's retention dimension). */
  isRetentionCheck: boolean;
  createdAt: number;
  /** Set when this question is a follow-up to a shallow prior answer. */
  followUpToChallengeId?: string;
  /**
   * Whether an AI provider wrote this question, or a local deterministic
   * template did — shown in the UI so it's never ambiguous. Optional here
   * only so individual templates don't each have to set it; QuestionGenerator
   * fills in 'deterministic' by default, and AIQuestionGenerator sets 'ai'
   * explicitly, so every question that actually reaches a caller has it.
   */
  generatedBy?: 'ai' | 'deterministic';
}

export interface ChallengeAnswer {
  questionId: string;
  kind: 'multiple-choice' | 'free-text';
  selectedOptionId?: string;
  text?: string;
  answeredAt: number;
  timeTakenMs: number;
}

export interface ChallengeRecord {
  question: GeneratedQuestion;
  answer: ChallengeAnswer;
  evaluation: import('../scoring/ScoreTypes').EvaluationResult;
}
