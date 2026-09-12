import type { ChallengeCategory, Difficulty, QuestionType } from '../questions/QuestionTypes';

export interface AIQuestionContext {
  category: ChallengeCategory;
  questionType: QuestionType;
  difficulty: Difficulty;
  filePath: string;
  /** A bounded code snippet (a function body, not a whole file/repo) — see spec section 15/17. */
  codeSnippet: string;
  changeReason?: string;
}

export interface AIGeneratedQuestionPayload {
  prompt: string;
  kind: 'multiple-choice' | 'free-text';
  options?: { id: string; text: string }[];
  correctOptionId?: string;
  rubricKeywords?: string[];
  reason?: string;
}

export interface AIEvaluationContext {
  questionPrompt: string;
  codeSnippet: string;
  category: string;
  developerAnswer: string;
}

export interface AIEvaluationPayload {
  score: number;
  correct: boolean;
  confidence: number;
  strengths: string[];
  gaps: string[];
  feedback: string;
}

/**
 * A source of AI-generated questions and evaluations. Exactly two
 * implementations exist: VsCodeLmProvider (whatever chat model the
 * developer already has, e.g. GitHub Copilot) and AnthropicProvider (a
 * manually configured API key, used only when no VS Code Language Model is
 * available). Both are optional — QuestionEngine and the scoring layer
 * work fully offline without either.
 */
export interface AIProvider {
  readonly id: 'vscode-lm' | 'anthropic';
  readonly label: string;
  generateQuestion(ctx: AIQuestionContext): Promise<AIGeneratedQuestionPayload | undefined>;
  evaluateFreeText(ctx: AIEvaluationContext): Promise<AIEvaluationPayload | undefined>;
}
