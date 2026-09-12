import Anthropic from '@anthropic-ai/sdk';
import { buildEvaluationPrompt, buildGenerationPrompt } from './prompts';
import { extractJsonObject, validateEvaluationPayload, validateGenerationPayload } from './parseAIResponse';
import type {
  AIEvaluationContext,
  AIEvaluationPayload,
  AIGeneratedQuestionPayload,
  AIProvider,
  AIQuestionContext,
} from './AITypes';
import type { AnthropicModel } from '../storage/StorageSchema';
import { getLogger } from '../../utils/logger';

const MAX_TOKENS = 1024;

/**
 * Manual "bring your own API key" fallback, used only when no VS Code
 * Language Model is available. The key lives in VS Code's SecretStorage —
 * never in settings.json, never logged.
 */
export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic' as const;
  readonly label = 'Anthropic API';
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly model: AnthropicModel) {
    this.client = new Anthropic({ apiKey });
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

  private async send(system: string, user: string): Promise<string | undefined> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
      return block?.text;
    } catch (err) {
      getLogger().warn('Anthropic API request failed', { error: String(err) });
      return undefined;
    }
  }
}
