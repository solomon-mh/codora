import * as vscode from 'vscode';
import { buildEvaluationPrompt, buildGenerationPrompt } from './prompts';
import { extractJsonObject, validateEvaluationPayload, validateGenerationPayload } from './parseAIResponse';
import { pickPreferredModel } from './pickPreferredModel';
import { inferVendor } from './AIIdentity';
import { BaseAIProvider } from './BaseAIProvider';
import type {
  AIEvaluationContext,
  AIEvaluationPayload,
  AIGenerationResult,
  AIProvider,
  AIQuestionContext,
} from './AITypes';
import type { AIVendor } from './AIIdentity';
import { getLogger } from '../../utils/logger';

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Uses whatever chat model the developer already has available in VS Code
 * via the built-in Language Model API — no separate API key, no extra
 * account. When multiple models are registered, pickPreferredModel()
 * prefers a dedicated coding agent (Claude, Codex, etc.) over GitHub
 * Copilot over anything else, so this picks the AI the developer is
 * actually working with. `selectChatModels`/`sendRequest` trigger VS
 * Code's own consent UI the first time; per the API's own contract, this
 * must only be reached in response to a user action, which holds here
 * since generateChallenge() is only ever invoked from a command or a user
 * clicking "Take Challenge" on a notification.
 */
export class VsCodeLmProvider extends BaseAIProvider implements AIProvider {
  readonly id = 'vscode-lm' as const;
  readonly label: string;
  readonly vendor: AIVendor;
  readonly modelName: string;
  /** False for a generic/router match (e.g. Copilot's "Auto") — see AIProviderResolver, which tries a manually configured key first in that case. */
  readonly isKnownAgent: boolean;

  constructor(private readonly model: vscode.LanguageModelChat, isKnownAgent: boolean) {
    super();
    this.isKnownAgent = isKnownAgent;
    this.label = `VS Code Language Model (${model.name})`;
    // `name` is the display name the publishing extension chose, so it's
    // the one string here guaranteed to mean something to the developer —
    // `family`/`id` are often internal slugs.
    this.vendor = inferVendor(model.vendor, model.family, model.name);
    this.modelName = model.name;
  }

  static async resolve(): Promise<VsCodeLmProvider | undefined> {
    try {
      const models = await vscode.lm.selectChatModels();
      // Logged in full because "which models does this editor actually
      // expose?" is not answerable any other way, and it's the only way to
      // tell "my AI extension isn't registered with vscode.lm" apart from
      // "Codora picked the wrong one".
      getLogger().info('vscode.lm chat models available', {
        count: models.length,
        models: models.map((m) => ({
          vendor: m.vendor,
          family: m.family,
          name: m.name,
          id: m.id,
          maxInputTokens: m.maxInputTokens,
        })),
      });

      const picked = pickPreferredModel(models);
      if (picked) {
        getLogger().info('vscode.lm model selected', {
          name: picked.model.name,
          vendor: picked.model.vendor,
          family: picked.model.family,
          isKnownAgent: picked.isKnownAgent,
        });
      }
      return picked ? new VsCodeLmProvider(picked.model, picked.isKnownAgent) : undefined;
    } catch (err) {
      getLogger().warn('vscode.lm.selectChatModels failed', { error: String(err) });
      return undefined;
    }
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

  // Deliberately no catch-and-swallow around sendRequest here: callers
  // (tryGenerateAIQuestion, HybridEvaluator) need the real error — e.g.
  // LanguageModelError.NoPermissions vs a timeout are very different
  // problems, and a generic "request failed" makes them indistinguishable.
  private async send(system: string, user: string): Promise<string | undefined> {
    // The Language Model API has no distinct system-role message, so the
    // instructions and the task are combined into one user message with
    // clear section markers.
    const messages = [vscode.LanguageModelChatMessage.User(`${system}\n\n${user}`)];
    const cts = new vscode.CancellationTokenSource();
    const timer = setTimeout(() => cts.cancel(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.model.sendRequest(messages, {}, cts.token);

      // Iterating `stream` rather than `text` on purpose: `text` silently
      // drops every non-text part, so a model that answers with only
      // tool-call/other parts is indistinguishable from one that answered
      // nothing at all. Collecting the part types lets an empty result say
      // *which* of those happened.
      let out = '';
      const partTypes = new Set<string>();
      for await (const part of response.stream) {
        if (part instanceof vscode.LanguageModelTextPart) {
          partTypes.add('text');
          out += part.value;
        } else {
          partTypes.add((part as object)?.constructor?.name ?? typeof part);
        }
      }

      if (!out) {
        getLogger().warn('vscode.lm returned no text', {
          model: this.model.name,
          vendor: this.model.vendor,
          partTypesSeen: [...partTypes],
          promptChars: system.length + user.length,
        });
      }
      return out;
    } finally {
      clearTimeout(timer);
      cts.dispose();
    }
  }
}
