export interface ModelLike {
  vendor: string;
  family: string;
  name: string;
}

export interface PickedModel<T> {
  model: T;
  /** True when the match looks like a dedicated coding agent (Claude, Codex), not a generic/router model. */
  isKnownAgent: boolean;
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
 * naming, not a guaranteed one. `isKnownAgent` on the result lets a
 * caller treat a generic match (e.g. Copilot's "Auto" router) with less
 * trust than a specifically-identified agent — see AIProviderResolver,
 * which tries a manually configured key before a generic vscode.lm match,
 * since a router model has been observed silently returning
 * empty/unparseable output for a structured-JSON-only task.
 */
export function pickPreferredModel<T extends ModelLike>(models: T[]): PickedModel<T> | undefined {
  if (models.length === 0) return undefined;

  const isKnownAgent = (m: T) => m.vendor !== 'copilot' && AGENT_KEYWORDS.test(`${m.vendor} ${m.family} ${m.name}`);
  const isCopilot = (m: T) => m.vendor === 'copilot';

  const agent = models.find(isKnownAgent);
  if (agent) return { model: agent, isKnownAgent: true };

  const copilot = models.find(isCopilot);
  if (copilot) return { model: copilot, isKnownAgent: false };

  return { model: models[0], isKnownAgent: false };
}
