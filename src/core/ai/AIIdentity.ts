/**
 * Who actually wrote a question.
 *
 * Kept in its own module, importing nothing, because both ends need it:
 * `AITypes` (every provider declares its identity) and `QuestionTypes` (a
 * stored question carries the identity of whatever produced it). A shared
 * leaf module keeps that from becoming a cycle.
 *
 * This exists so the UI never has to label a question with a bare "AI".
 * Which model asked the question changes how much a developer trusts it,
 * and a stored history of answers is far more useful when each row says
 * which model it came from.
 */

export type AIProviderId = 'claude-cli' | 'vscode-lm' | 'anthropic' | 'openai' | 'gemini';

/**
 * The organization behind the model, as distinct from how Codora reached
 * it: the Claude Code CLI and a pasted Anthropic key are different
 * providers but the same vendor, and a `vscode.lm` model can be any of
 * them depending on which extension published it.
 */
export type AIVendor = 'anthropic' | 'openai' | 'google' | 'copilot' | 'unknown';

export interface AIModelIdentity {
  providerId: AIProviderId;
  vendor: AIVendor;
  /** Display name of the concrete model, e.g. 'Claude Sonnet 5', 'GPT-4o mini', 'Gemini 3.6 Flash'. */
  modelName: string;
}

const VENDOR_PATTERNS: [AIVendor, RegExp][] = [
  ['anthropic', /claude|anthropic/i],
  ['openai', /gpt|openai|codex|o[34]-(mini|preview)/i],
  ['google', /gemini|google|palm/i],
];

/**
 * Best-effort vendor for a model Codora didn't configure itself — i.e. one
 * handed over by `vscode.lm`, where naming is up to whichever extension
 * registered it. Copilot is checked last on purpose: it publishes other
 * vendors' models under `vendor: 'copilot'`, and naming the real model
 * maker is more informative than naming the broker.
 */
export function inferVendor(vendor: string, family: string, name: string): AIVendor {
  const haystack = `${vendor} ${family} ${name}`;
  for (const [id, pattern] of VENDOR_PATTERNS) {
    if (pattern.test(haystack)) return id;
  }
  if (/copilot/i.test(haystack)) return 'copilot';
  return 'unknown';
}
