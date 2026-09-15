import type { AIModelIdentity, AIProviderId } from '../../src/core/ai/AIIdentity';
import { IconCloud, IconFile, IconPlug, IconTerminal } from './Icons';
import type { IconProps } from './Icons';

/**
 * Names the model that wrote a question, rather than labelling it "AI".
 *
 * "AI" is not an answer to the question a developer actually has when they
 * read a challenge — a prompt from Claude Opus and one from a Flash-tier
 * model deserve different amounts of trust, and a history of past answers
 * is only comparable if each row says which model produced it.
 *
 * The icon reports how Codora reached the model (local CLI, borrowed from
 * the editor, or a network call on the developer's own key), which is the
 * part that matters for privacy and cost; the text names who made it.
 */
const PROVIDER_ROUTES: Record<AIProviderId, { Icon: (p: IconProps) => JSX.Element; via: string }> = {
  'claude-cli': { Icon: IconTerminal, via: 'the Claude Code CLI on this machine' },
  'vscode-lm': { Icon: IconPlug, via: "this editor's language model API" },
  anthropic: { Icon: IconCloud, via: 'your Anthropic API key' },
  openai: { Icon: IconCloud, via: 'your OpenAI API key' },
  gemini: { Icon: IconCloud, via: 'your Gemini API key' },
};

export function ModelBadge({
  generator,
  generatedBy,
  size = 10,
}: {
  generator?: AIModelIdentity;
  /** Only history records stored before local templates were removed say 'deterministic'. */
  generatedBy?: 'ai' | 'deterministic';
  size?: number;
}): JSX.Element {
  if (generatedBy === 'deterministic') {
    return (
      <span className="c-pill" title="Written by a local deterministic template — no model involved">
        <IconFile size={size} />
        Template
      </span>
    );
  }

  // Questions stored before Codora recorded the model keep an honest
  // "a model wrote this, but which one wasn't kept" rather than being
  // attributed to whichever provider happens to be configured today.
  if (!generator) {
    return (
      <span className="c-pill c-pill-accent" title="Written by a model — this record predates Codora recording which one">
        <IconCloud size={size} />
        Model
      </span>
    );
  }

  const route = PROVIDER_ROUTES[generator.providerId];
  const Icon = route?.Icon ?? IconCloud;

  return (
    <span
      className="c-pill c-pill-accent c-pill-model"
      title={`Written by ${generator.modelName}, reached through ${route?.via ?? 'a configured provider'}, from your own code`}
    >
      <Icon size={size} />
      <span className="c-pill-model-name">{generator.modelName}</span>
    </span>
  );
}
