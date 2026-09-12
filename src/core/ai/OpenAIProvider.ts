import OpenAI from 'openai';
import { buildEvaluationPrompt, buildGenerationPrompt } from './prompts';
import { extractJsonObject, validateEvaluationPayload, validateGenerationPayload } from './parseAIResponse';
import type {
  AIEvaluationContext,
  AIEvaluationPayload,
  AIGeneratedQuestionPayload,
  AIProvider,
  AIQuestionContext,
} from './AITypes';
import type { OpenAIModel } from '../storage/StorageSchema';

const MAX_COMPLETION_TOKENS = 1024;

/**
 * Second manual "bring your own API key" fallback, alongside
 * AnthropicProvider, used only when no VS Code Language Model is
 * available. The key lives in VS Code's SecretStorage — never in
 * settings.json, never logged.
 */
export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;
  readonly label = 'OpenAI API';
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model: OpenAIModel) {
    this.client = new OpenAI({ apiKey });
  }

  async generateQuestion(ctx: AIQuestionContext): Promise<AIGeneratedQuestionPayload | undefined> {
    const { system, user } = buildGenerationPrompt(ctx);
    const text = await this.send(system, user);
    if (!text) return undefined;
    return validateGenerationPayload(extractJsonObject(text));
  }

  async evaluateFreeText(ctx: AIEvaluationContext): Promise<AIEvaluationPayload | undefined> {
    const { system, user } = buildEvaluationPrompt(ctx);
    const text = await this.send(system, user);
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
