import Anthropic from '@anthropic-ai/sdk';
import { buildEvaluationPrompt, buildGenerationPrompt } from './prompts';
import { extractJsonObject, validateEvaluationPayload, validateGenerationPayload } from './parseAIResponse';
import { BaseAIProvider } from './BaseAIProvider';
import type {
  AIEvaluationContext,
  AIEvaluationPayload,
  AIGeneratedQuestionPayload,
  AIProvider,
  AIQuestionContext,
} from './AITypes';
import type { AnthropicModel } from '../storage/StorageSchema';

const MAX_TOKENS = 1024;

/**
 * Manual "bring your own API key" fallback, used only when no VS Code
 * Language Model is available. The key lives in VS Code's SecretStorage —
 * never in settings.json, never logged.
 */
export class AnthropicProvider extends BaseAIProvider implements AIProvider {
  readonly id = 'anthropic' as const;
  readonly label = 'Anthropic API';
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly model: AnthropicModel) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async generateQuestion(ctx: AIQuestionContext): Promise<AIGeneratedQuestionPayload | undefined> {
    const { system, user } = buildGenerationPrompt(ctx);
    const text = await this.send(system, user);
    this.recordRawResponse(text);
    if (!text) return undefined;
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
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    return block?.text;
  }
}
