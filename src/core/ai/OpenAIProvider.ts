import OpenAI from 'openai';
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
import { OPENAI_MODEL_NAMES } from './modelDisplayName';
import type { OpenAIModel } from '../storage/StorageSchema';

const MAX_COMPLETION_TOKENS = 1024;

/**
 * Second manual "bring your own API key" fallback, alongside
 * AnthropicProvider, used only when no VS Code Language Model is
 * available. The key lives in VS Code's SecretStorage — never in
 * settings.json, never logged.
 */
export class OpenAIProvider extends BaseAIProvider implements AIProvider {
  readonly id = 'openai' as const;
  readonly label = 'OpenAI API';
  readonly vendor = 'openai' as const;
  readonly modelName: string;
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model: OpenAIModel) {
    super();
    this.modelName = OPENAI_MODEL_NAMES[model];
    this.client = new OpenAI({ apiKey });
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
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return response.choices[0]?.message?.content ?? undefined;
  }
}
