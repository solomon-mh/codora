import type { AnthropicModel, GeminiModel, OpenAIModel } from '../storage/StorageSchema';

/**
 * Human-readable names for the model ids Codora can be configured with.
 *
 * Written out per model rather than derived from the id by a formatting
 * rule: vendor naming is not mechanical ('claude-haiku-4-5' is "Haiku
 * 4.5", 'gpt-4o-mini' is "GPT-4o mini"), and a rule that gets one of them
 * right gets the others subtly wrong. `Record<Model, string>` also makes
 * the compiler demand a name whenever a model is added to the union.
 */
export const ANTHROPIC_MODEL_NAMES: Record<AnthropicModel, string> = {
  'claude-haiku-4-5': 'Claude Haiku 4.5',
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-opus-5': 'Claude Opus 5',
};

export const OPENAI_MODEL_NAMES: Record<OpenAIModel, string> = {
  'gpt-4o-mini': 'GPT-4o mini',
  'gpt-4o': 'GPT-4o',
};

export const GEMINI_MODEL_NAMES: Record<GeminiModel, string> = {
  'gemini-3.6-flash': 'Gemini 3.6 Flash',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
};
