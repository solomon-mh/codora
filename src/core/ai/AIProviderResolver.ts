import * as vscode from 'vscode';
import { VsCodeLmProvider } from './VsCodeLmProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { OpenAIProvider } from './OpenAIProvider';
import type { AIProvider } from './AITypes';
import type { StorageManager } from '../storage/StorageManager';
import type { CodoraSettings } from '../storage/StorageSchema';

const SECRET_KEY_ANTHROPIC = 'codora.anthropicApiKey';
const SECRET_KEY_OPENAI = 'codora.openaiApiKey';

export type AIStatus = 'vscode-lm' | 'anthropic' | 'openai' | 'none-configured' | 'disabled';

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

    return this.getConfiguredManualProvider(settings.ai);
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

  async clearManualApiKeys(): Promise<void> {
    await this.secrets.delete(SECRET_KEY_ANTHROPIC);
    await this.secrets.delete(SECRET_KEY_OPENAI);
  }

  async getStatus(): Promise<AIStatus> {
    const settings = this.storage.getGlobalProfile().settings;
    if (!settings.ai.enabled) return 'disabled';
    if (await VsCodeLmProvider.resolve()) return 'vscode-lm';
    if (await this.secrets.get(SECRET_KEY_ANTHROPIC)) return 'anthropic';
    if (await this.secrets.get(SECRET_KEY_OPENAI)) return 'openai';
    return 'none-configured';
  }

  private async promptToConfigure(forced: boolean): Promise<AIProvider | undefined> {
    const options = forced
      ? ['Use Available AI', 'Set API Key', 'Cancel']
      : ['Use Available AI', 'Set API Key', 'Not Now'];

    const choice = await vscode.window.showInformationMessage(
      'Codora can generate richer questions and evaluate free-text answers using an AI model. Use one?',
      ...options,
    );

    if (choice === 'Use Available AI') {
      const lm = await VsCodeLmProvider.resolve();
      if (lm) return lm;
      void vscode.window.showWarningMessage(
        'Codora: no AI model is currently available in VS Code. This needs an extension that registers one via the Language Model API — for GitHub Copilot specifically, that means the "GitHub Copilot Chat" extension (not just base Copilot completions), installed, enabled, and with an active Copilot entitlement — an open Copilot Chat panel is the quickest way to confirm that. Or set an API key instead.',
      );
      return undefined;
    }

    if (choice === 'Set API Key') {
      return this.promptForApiKey();
    }

    if (!forced) {
      await this.storage.updateGlobalProfile((p) => ({ ...p, aiPromptDismissed: true }));
    }
    return undefined;
  }

  private async promptForApiKey(): Promise<AIProvider | undefined> {
    const provider = await vscode.window.showQuickPick(
      [
        { label: 'Anthropic', description: 'Claude models', id: 'anthropic' as const },
        { label: 'OpenAI', description: 'GPT models', id: 'openai' as const },
      ],
      { placeHolder: 'Which provider is your API key for?' },
    );
    if (!provider) return undefined;

    const key = await vscode.window.showInputBox({
      prompt: `Enter your ${provider.label} API key — stored locally in VS Code secret storage, never synced or logged`,
      password: true,
      ignoreFocusOut: true,
      placeHolder: provider.id === 'anthropic' ? 'sk-ant-...' : 'sk-...',
    });
    if (!key) return undefined;

    const settings = this.storage.getGlobalProfile().settings;
    if (provider.id === 'anthropic') {
      await this.secrets.store(SECRET_KEY_ANTHROPIC, key);
      return new AnthropicProvider(key, settings.ai.anthropicModel);
    }
    await this.secrets.store(SECRET_KEY_OPENAI, key);
    return new OpenAIProvider(key, settings.ai.openAIModel);
  }

  private async getConfiguredManualProvider(aiSettings: CodoraSettings['ai']): Promise<AIProvider | undefined> {
    const anthropicKey = await this.secrets.get(SECRET_KEY_ANTHROPIC);
    if (anthropicKey) return new AnthropicProvider(anthropicKey, aiSettings.anthropicModel);

    const openaiKey = await this.secrets.get(SECRET_KEY_OPENAI);
    if (openaiKey) return new OpenAIProvider(openaiKey, aiSettings.openAIModel);

    return undefined;
  }
}
