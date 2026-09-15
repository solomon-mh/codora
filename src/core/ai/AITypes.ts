import type { AIProviderId, AIVendor } from './AIIdentity';
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

/**
 * What one generation attempt produced.
 *
 * 'declined' and 'unusable' are kept apart because they mean opposite
 * things about the provider. A decline is the model doing exactly what the
 * generation prompt asks — "if the code shown genuinely does not support a
 * confident question of this type, respond with {\"skip\": true}" — and
 * says the *snippet and question type* were a bad pairing, not that
 * anything is wrong with the provider. 'unusable' is empty or malformed
 * output, which is a genuine provider problem. Collapsing both into
 * `undefined` made a well-behaved model get reported to the user as
 * returning a response that "didn't match the expected format".
 */
export type AIGenerationResult =
  | { outcome: 'question'; payload: AIGeneratedQuestionPayload }
  | { outcome: 'declined' }
  | { outcome: 'unusable' };

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
 * A source of AI-generated questions and evaluations. Five implementations
 * exist, tried in the order AIProviderResolver decides:
 *
 * - ClaudeCliProvider — the Claude Code CLI, running on the developer's
 *   existing Claude auth (no API key). Preferred when present.
 * - VsCodeLmProvider — whatever chat model the editor publishes via
 *   `vscode.lm` (e.g. GitHub Copilot Chat).
 * - AnthropicProvider / OpenAIProvider / GeminiProvider — manual API keys.
 *
 * All are optional. Question generation needs at least one (there is no
 * local-template fallback), while answer scoring degrades locally.
 */
export interface AIProvider {
  readonly id: AIProviderId;
  readonly label: string;
  /** Who makes the model behind this provider — the UI names it rather than saying "AI". */
  readonly vendor: AIVendor;
  /** The concrete model in play, e.g. 'Claude Sonnet 5'. Stored on every question this provider writes. */
  readonly modelName: string;
  generateQuestion(ctx: AIQuestionContext): Promise<AIGenerationResult>;
  evaluateFreeText(ctx: AIEvaluationContext): Promise<AIEvaluationPayload | undefined>;
  /**
   * A truncated preview of the most recent raw model response — only
   * meaningful immediately after a generateQuestion/evaluateFreeText call
   * that returned undefined, to diagnose *why* (e.g. the model answered in
   * prose instead of JSON) instead of a bare "invalid response".
   */
  getLastRawResponsePreview(): string | undefined;
}
