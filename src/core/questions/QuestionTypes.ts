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

export const ALL_QUESTION_TYPES: QuestionType[] = [
  'recall',
  'prediction',
  'cause',
  'debugging',
  'architecture',
  'testing',
  'security',
  'performance',
];

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

/** A source file (path + contents) that a question can be generated from. */
export interface FileContext {
  relativePath: string;
  text: string;
}

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
   * How this question was produced. Every question generated now is 'ai';
   * 'deterministic' only appears on history records stored before local
   * template generation was removed, which the history UI still labels
   * correctly.
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
