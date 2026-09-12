import * as vscode from 'vscode';
import { VsCodeLmProvider } from './VsCodeLmProvider';
import { AnthropicProvider } from './AnthropicProvider';
import type { AIProvider } from './AITypes';
import type { StorageManager } from '../storage/StorageManager';
import type { AnthropicModel } from '../storage/StorageSchema';

const SECRET_KEY_ANTHROPIC = 'codora.anthropicApiKey';

export type AIStatus = 'vscode-lm' | 'anthropic' | 'none-configured' | 'disabled';

/**
 * Resolves which AI backend (if any) Codora should use, preferring
 * whatever the developer is already using in VS Code over a manually
 * configured key, and prompting to configure one only when nothing is
 * available and the user hasn't already said "not now" (spec: AI is an
 * optional enhancement, never a requirement — see DeterministicEvaluator
 * and the template-based QuestionEngine, which work with no AI at all).
 */
export class AIProviderResolver {
  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly storage: StorageManager,
  ) {}

  /** Checks availability only — never shows a prompt. Safe to call from any path. */
  async resolveSilently(): Promise<AIProvider | undefined> {
    const settings = this.storage.getGlobalProfile().settings;
    if (!settings.ai.enabled) return undefined;

    const lm = await VsCodeLmProvider.resolve();
    if (lm) return lm;

    return this.getConfiguredAnthropic(settings.ai.anthropicModel);
  }

  /**
   * Resolves silently first; if nothing is available and the user hasn't
   * dismissed the prompt before, offers to configure one. Only ever called
   * from a user-initiated path (a command, or clicking "Take Challenge"),
   * matching the Language Model API's own consent requirements.
   */
  async resolveOrPrompt(): Promise<AIProvider | undefined> {
    const settings = this.storage.getGlobalProfile().settings;
    if (!settings.ai.enabled) return undefined;

    const existing = await this.resolveSilently();
    if (existing) return existing;

    if (this.storage.getGlobalProfile().aiPromptDismissed) return undefined;

    return this.promptToConfigure(false);
  }

  /** Always-interactive flow for the explicit "Codora: Configure AI Provider" command. */
  async configureInteractively(): Promise<AIProvider | undefined> {
    return this.promptToConfigure(true);
  }

  async clearAnthropicKey(): Promise<void> {
    await this.secrets.delete(SECRET_KEY_ANTHROPIC);
  }

  async getStatus(): Promise<AIStatus> {
    const settings = this.storage.getGlobalProfile().settings;
    if (!settings.ai.enabled) return 'disabled';
    if (await VsCodeLmProvider.resolve()) return 'vscode-lm';
    if (await this.secrets.get(SECRET_KEY_ANTHROPIC)) return 'anthropic';
    return 'none-configured';
  }

  private async promptToConfigure(forced: boolean): Promise<AIProvider | undefined> {
    const options = forced
      ? ['Use Available AI', 'Set Anthropic API Key', 'Cancel']
      : ['Use Available AI', 'Set Anthropic API Key', 'Not Now'];

    const choice = await vscode.window.showInformationMessage(
      'Codora can generate richer questions and evaluate free-text answers using an AI model. Use one?',
      ...options,
    );

    if (choice === 'Use Available AI') {
      const lm = await VsCodeLmProvider.resolve();
      if (lm) return lm;
      void vscode.window.showWarningMessage(
        'Codora: no AI model is currently available in VS Code. Install/enable an extension that provides one (e.g. GitHub Copilot Chat), or set an Anthropic API key instead.',
      );
      return undefined;
    }

    if (choice === 'Set Anthropic API Key') {
      return this.promptForAnthropicKey();
    }

    if (!forced) {
      await this.storage.updateGlobalProfile((p) => ({ ...p, aiPromptDismissed: true }));
    }
    return undefined;
  }

  private async promptForAnthropicKey(): Promise<AnthropicProvider | undefined> {
    const key = await vscode.window.showInputBox({
      prompt: 'Enter your Anthropic API key — stored locally in VS Code secret storage, never synced or logged',
      password: true,
      ignoreFocusOut: true,
      placeHolder: 'sk-ant-...',
    });
    if (!key) return undefined;

    await this.secrets.store(SECRET_KEY_ANTHROPIC, key);
    const model = this.storage.getGlobalProfile().settings.ai.anthropicModel;
    return new AnthropicProvider(key, model);
  }

  private async getConfiguredAnthropic(model: AnthropicModel): Promise<AnthropicProvider | undefined> {
    const key = await this.secrets.get(SECRET_KEY_ANTHROPIC);
    return key ? new AnthropicProvider(key, model) : undefined;
  }
}
