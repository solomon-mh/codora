import { buildAnswerCheckPrompt, buildEvaluationPrompt, buildGenerationPrompt } from './prompts';
import {
  extractJsonObject,
  validateAnswerCheckPayload,
  validateEvaluationPayload,
  validateGenerationPayload,
} from './parseAIResponse';
import type {
  AIAnswerCheck,
  AIAnswerCheckContext,
  AIEvaluationContext,
  AIEvaluationPayload,
  AIGenerationResult,
  AIQuestionContext,
} from './AITypes';

/**
 * What every provider does with a model, written once. Each provider only
 * supplies `send` — how to get a text completion for a system + user
 * prompt from its own API — and inherits the prompts, JSON extraction and
 * validation, so all five behave identically.
 *
 * Also keeps the last raw response, so a validation failure can be
 * diagnosed (what did the model actually say?) instead of just reported as
 * "invalid response".
 */
export abstract class BaseAIProvider {
  private lastRawResponse: string | undefined;

  /** One completion. Must throw the provider's real error rather than swallow it — callers classify it. */
  protected abstract send(system: string, user: string): Promise<string | undefined>;

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

  async checkAnswerKey(ctx: AIAnswerCheckContext): Promise<AIAnswerCheck | undefined> {
    const { system, user } = buildAnswerCheckPrompt(ctx);
    const text = await this.send(system, user);
    this.recordRawResponse(text);
    if (!text) return undefined;
    return validateAnswerCheckPayload(extractJsonObject(text), ctx.options.map((o) => o.id));
  }

  protected recordRawResponse(text: string | undefined): void {
    this.lastRawResponse = text;
  }

  getLastRawResponsePreview(): string | undefined {
    if (!this.lastRawResponse) return undefined;
    const trimmed = this.lastRawResponse.trim();
    if (!trimmed) return undefined;
    return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
  }
}
