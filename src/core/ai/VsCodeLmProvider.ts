import * as vscode from 'vscode';
import { buildEvaluationPrompt, buildGenerationPrompt } from './prompts';
import { extractJsonObject, validateEvaluationPayload, validateGenerationPayload } from './parseAIResponse';
import { pickPreferredModel } from './pickPreferredModel';
import type {
  AIEvaluationContext,
  AIEvaluationPayload,
  AIGeneratedQuestionPayload,
  AIProvider,
  AIQuestionContext,
} from './AITypes';
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
export class VsCodeLmProvider implements AIProvider {
  readonly id = 'vscode-lm' as const;
  readonly label: string;

  constructor(private readonly model: vscode.LanguageModelChat) {
    this.label = `VS Code Language Model (${model.name})`;
  }

  static async resolve(): Promise<VsCodeLmProvider | undefined> {
    try {
      const models = await vscode.lm.selectChatModels();
      const preferred = pickPreferredModel(models);
      return preferred ? new VsCodeLmProvider(preferred) : undefined;
    } catch (err) {
      getLogger().debug('vscode.lm.selectChatModels failed', { error: String(err) });
      return undefined;
    }
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
    // The Language Model API has no distinct system-role message, so the
    // instructions and the task are combined into one user message with
    // clear section markers.
    const messages = [vscode.LanguageModelChatMessage.User(`${system}\n\n${user}`)];
    const cts = new vscode.CancellationTokenSource();
    const timer = setTimeout(() => cts.cancel(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.model.sendRequest(messages, {}, cts.token);
      let out = '';
      for await (const fragment of response.text) out += fragment;
      return out;
    } catch (err) {
      getLogger().warn('VS Code Language Model request failed', { error: String(err) });
      return undefined;
    } finally {
      clearTimeout(timer);
      cts.dispose();
    }
  }
}
