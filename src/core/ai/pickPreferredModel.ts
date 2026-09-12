export interface ModelLike {
  vendor: string;
  family: string;
  name: string;
}

const AGENT_KEYWORDS = /claude|anthropic|codex/i;

/**
 * Among the chat models VS Code's Language Model API reports as available,
 * prefers a dedicated AI coding agent (Claude, Codex, etc.) if one is
 * registered, then GitHub Copilot, then whatever else is available — so
 * "whatever AI the developer is already using" picks the agent they're
 * actually working with over a secondary/incidental one.
 *
 * Vendor/family naming for third-party agent extensions isn't
 * standardized (`vendor: 'copilot'` is the one documented, stable
 * identifier), so the agent match is a best-effort heuristic on common
 * naming, not a guaranteed one.
 */
export function pickPreferredModel<T extends ModelLike>(models: T[]): T | undefined {
  if (models.length === 0) return undefined;

  const isKnownAgent = (m: T) => m.vendor !== 'copilot' && AGENT_KEYWORDS.test(`${m.vendor} ${m.family} ${m.name}`);
  const isCopilot = (m: T) => m.vendor === 'copilot';

  return models.find(isKnownAgent) ?? models.find(isCopilot) ?? models[0];
}
