import { GoogleGenAI } from '@google/genai';
import { buildEvaluationPrompt, buildGenerationPrompt } from './prompts';
import { extractJsonObject, validateEvaluationPayload, validateGenerationPayload } from './parseAIResponse';
import { BaseAIProvider } from './BaseAIProvider';
import type {
  AIEvaluationContext,
  AIEvaluationPayload,
  AIGenerationResult,
  AIProvider,
  AIQuestionContext,
} from './AITypes';
import { GEMINI_MODEL_NAMES } from './modelDisplayName';
import type { GeminiModel } from '../storage/StorageSchema';

/**
 * Third manual "bring your own API key" fallback, alongside Anthropic and
 * OpenAI, used only when no VS Code Language Model is available. The key
 * lives in VS Code's SecretStorage — never in settings.json, never logged.
 */
export class GeminiProvider extends BaseAIProvider implements AIProvider {
  readonly id = 'gemini' as const;
  readonly label = 'Gemini API';
  readonly vendor = 'google' as const;
  readonly modelName: string;
  private readonly client: GoogleGenAI;

  constructor(apiKey: string, private readonly model: GeminiModel) {
    super();
    this.modelName = GEMINI_MODEL_NAMES[model];
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateQuestion(ctx: AIQuestionContext): Promise<AIGenerationResult> {
    const { system, user } = buildGenerationPrompt(ctx);
    const text = await this.send(system, user);
    this.recordRawResponse(text);
    if (!text) return { outcome: 'unusable' };
    return validateGenerationPayload(extractJsonObject(text));
  }

  async evaluateFreeText(ctx: AIEvaluationContext): Promise<AIEvaluationPayload | undefined> {
    const { system, user } = buildEvaluationPrompt(ctx);
    const text = await this.send(system, user);
    this.recordRawResponse(text);
    if (!text) return undefined;
    return validateEvaluationPayload(extractJsonObject(text));
  }

  // Deliberately no try/catch here: callers (tryGenerateAIQuestion,
  // HybridEvaluator) need the real error — a generic "request failed" with
  // no detail makes an auth/network/rate-limit problem indistinguishable
  // from "the model declined", and is impossible to diagnose from logs.
  private async send(system: string, user: string): Promise<string | undefined> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: user,
      config: { systemInstruction: system },
    });
    return response.text;
  }
}
