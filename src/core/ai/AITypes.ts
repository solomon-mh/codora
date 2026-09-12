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
 * A source of AI-generated questions and evaluations. Three
 * implementations exist: VsCodeLmProvider (whatever chat model the
 * developer already has, e.g. GitHub Copilot), and two manual-API-key
 * fallbacks — AnthropicProvider and OpenAIProvider — used only when no VS
 * Code Language Model is available. All are optional — QuestionEngine and
 * the scoring layer work fully offline without any of them.
 */
export interface AIProvider {
  readonly id: 'vscode-lm' | 'anthropic' | 'openai';
  readonly label: string;
  generateQuestion(ctx: AIQuestionContext): Promise<AIGeneratedQuestionPayload | undefined>;
  evaluateFreeText(ctx: AIEvaluationContext): Promise<AIEvaluationPayload | undefined>;
  /**
   * A truncated preview of the most recent raw model response — only
   * meaningful immediately after a generateQuestion/evaluateFreeText call
   * that returned undefined, to diagnose *why* (e.g. the model answered in
   * prose instead of JSON) instead of a bare "invalid response".
   */
  getLastRawResponsePreview(): string | undefined;
}
