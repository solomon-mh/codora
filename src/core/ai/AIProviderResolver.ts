import * as vscode from 'vscode';
import { VsCodeLmProvider } from './VsCodeLmProvider';
import { ClaudeCliProvider } from './ClaudeCliProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { GeminiProvider } from './GeminiProvider';
import type { AIProvider } from './AITypes';
import type { StorageManager } from '../storage/StorageManager';
import type { CodoraSettings } from '../storage/StorageSchema';

const SECRET_KEY_ANTHROPIC = 'codora.anthropicApiKey';
const SECRET_KEY_OPENAI = 'codora.openaiApiKey';
const SECRET_KEY_GEMINI = 'codora.geminiApiKey';

export type AIStatus =
  | 'claude-cli'
  | 'vscode-lm'
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'none-configured'
  | 'disabled';

/** Providers configured by pasting an API key (i.e. everything except the VS Code Language Model). */
export type ManualProviderId = 'anthropic' | 'openai' | 'gemini';

const PROVIDER_LABELS: Record<ManualProviderId, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Gemini',
};

/** Per-provider key shapes, used to catch a key pasted into the wrong provider's slot at entry time. */
const KEY_HINTS = {
  anthropic: { placeholder: 'sk-ant-...', expected: '"sk-ant-"', pattern: /^sk-ant-/ },
  openai: { placeholder: 'sk-...', expected: '"sk-"', pattern: /^sk-/ },
  // Google issues both the classic "AIza..." AI Studio keys and newer "AQ."-prefixed ones.
  gemini: { placeholder: 'AIza... or AQ....', expected: '"AIza" or "AQ."', pattern: /^(AIza|AQ\.)/ },
} as const;

/**
 * Resolves which AI backend(s) Codora should try, and in what order, and
 * prompts to configure one when nothing is available. Question generation
 * is AI-only — there is no local-template fallback — so when this returns
 * nothing, no challenge is offered and the caller explains why. (Answer
 * *evaluation* still degrades gracefully: multiple choice is always scored
 * locally by exact match, and DeterministicEvaluator backs up free-text
 * scoring if a provider fails mid-challenge.)
 *
 * Returns a *list*, not a single winner: a VS Code Language Model can
 * resolve successfully (a model handle exists) while still failing to
 * produce usable output for reasons that have nothing to do with
 * availability (content filtering, a model that won't follow the
 * JSON-only instruction, etc.). Priority is: the Claude Code CLI (runs on
 * the developer's existing Claude auth, no key, nothing to exhaust), then
 * a specifically-identified coding agent published via vscode.lm, then any
 * manually configured key, then a generic/router vscode.lm match (e.g.
 * Copilot's "Auto") last — see resolveCandidates for why that generic case
 * is untrusted enough to go behind a manual key rather than in front.
 */
export class AIProviderResolver {
  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly storage: StorageManager,
  ) {}

  /** Checks availability only — never shows a prompt. Safe to call from any path. */
  async resolveCandidates(): Promise<AIProvider[]> {
    const settings = this.storage.getGlobalProfile().settings;
    if (!settings.ai.enabled) return [];

    // Preferred outright when present: it's a first-party coding model
    // running on the developer's existing Claude auth, so it needs no key
    // and has no separate per-token bill to exhaust.
    const claudeCli = ClaudeCliProvider.resolve();
    const lm = await VsCodeLmProvider.resolve();
    const manual = await this.getConfiguredManualProviders(settings.ai);
    const cli = claudeCli ? [claudeCli] : [];

    // A specifically-identified coding agent (Claude, Codex) is trustworthy
    // and preferred outright. A generic/router match — in practice,
    // Copilot's "Auto" model — goes *after* any manually configured key: a
    // direct API key reliably follows a structured-JSON-only instruction,
    // whereas a vendor chat router has been observed silently returning
    // empty or unparseable output for this kind of non-chat, structured
    // task. Without this, a manually configured key could sit completely
    // unused behind a generic match that never actually works.
    if (lm?.isKnownAgent) return [...cli, lm, ...manual];
    return [...cli, ...manual, ...(lm ? [lm] : [])];
  }

  /**
   * Resolves candidates silently first; if nothing is available at all and
   * the user hasn't dismissed the prompt before, offers to configure one.
   * Only ever called from a user-initiated path (a command, or clicking
   * "Take Challenge"), matching the Language Model API's own consent
   * requirements.
   */
  async resolveCandidatesOrPrompt(): Promise<AIProvider[]> {
    const settings = this.storage.getGlobalProfile().settings;
    if (!settings.ai.enabled) return [];

    const existing = await this.resolveCandidates();
    if (existing.length > 0) return existing;

    if (this.storage.getGlobalProfile().aiPromptDismissed) return [];

    const prompted = await this.promptToConfigure(false);
    return prompted ? [prompted] : [];
  }

  /** Always-interactive flow for the explicit "Codora: Configure AI Provider" command. */
  async configureInteractively(): Promise<AIProvider | undefined> {
    return this.promptToConfigure(true);
  }

  async clearManualApiKeys(): Promise<void> {
    await this.secrets.delete(SECRET_KEY_ANTHROPIC);
    await this.secrets.delete(SECRET_KEY_OPENAI);
    await this.secrets.delete(SECRET_KEY_GEMINI);
  }

  /** Reports the first candidate in priority order, for the settings UI status line. */
  async getStatus(): Promise<AIStatus> {
    const settings = this.storage.getGlobalProfile().settings;
    if (!settings.ai.enabled) return 'disabled';
    const candidates = await this.resolveCandidates();
    return (candidates[0]?.id as AIStatus | undefined) ?? 'none-configured';
  }

  private async promptToConfigure(forced: boolean): Promise<AIProvider | undefined> {
    const options = forced
      ? ['Use Available AI', 'Set API Key', 'Clear Stored Keys', 'Cancel']
      : ['Use Available AI', 'Set API Key', 'Not Now'];

    const choice = await vscode.window.showInformationMessage(
      'Codora can generate richer questions and evaluate free-text answers using an AI model. Use one?',
      ...options,
    );

    if (choice === 'Clear Stored Keys') {
      await this.clearManualApiKeys();
      void vscode.window.showInformationMessage(
        'Codora: cleared all stored API keys. Run "Codora: Configure AI Provider" again to set one.',
      );
      return undefined;
    }

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
        { label: 'Gemini', description: 'Google AI Studio / Gemini API', id: 'gemini' as const },
      ],
      { placeHolder: 'Which provider is your API key for?' },
    );
    if (!provider) return undefined;
    return this.promptForProviderKey(provider.id);
  }

  /**
   * Sets up one specific provider, skipping the "which provider?" step.
   * Used when the choice has already been made elsewhere — e.g. the
   * challenge panel offers each provider as its own button.
   *
   * The key itself is always collected through VS Code's native masked
   * input box, never through a webview field, so a secret never travels
   * through webview JS or the postMessage boundary.
   */
  async setUpProvider(target: ManualProviderId | 'vscode-lm'): Promise<AIProvider | undefined> {
    if (target === 'vscode-lm') {
      const lm = await VsCodeLmProvider.resolve();
      if (lm) return lm;
      void vscode.window.showWarningMessage(
        'Codora: no AI model is currently available in VS Code. This needs an extension that registers one via the Language Model API — for GitHub Copilot specifically, that means the "GitHub Copilot Chat" extension (not just base Copilot completions), installed, enabled, and with an active Copilot entitlement — an open Copilot Chat panel is the quickest way to confirm that. Or set an API key instead.',
      );
      return undefined;
    }
    return this.promptForProviderKey(target);
  }

  private async promptForProviderKey(providerId: ManualProviderId): Promise<AIProvider | undefined> {
    const hint = KEY_HINTS[providerId];
    const label = PROVIDER_LABELS[providerId];

    const key = await vscode.window.showInputBox({
      prompt: `Enter your ${label} API key — stored locally in VS Code secret storage, never synced or logged`,
      password: true,
      ignoreFocusOut: true,
      placeHolder: hint.placeholder,
      // Catches the easy mistake of pasting one provider's key into
      // another's slot, which otherwise only shows up much later as an
      // opaque 401 buried in the output channel.
      validateInput: (value) => {
        const trimmed = value.trim();
        if (!trimmed) return 'An API key is required.';
        if (!hint.pattern.test(trimmed)) {
          return `That doesn't look like a ${label} key (expected it to start with ${hint.expected}). Check you picked the right provider.`;
        }
        return undefined;
      },
    });
    if (!key) return undefined;

    const settings = this.storage.getGlobalProfile().settings;
    if (providerId === 'anthropic') {
      await this.secrets.store(SECRET_KEY_ANTHROPIC, key);
      return new AnthropicProvider(key, settings.ai.anthropicModel);
    }
    if (providerId === 'openai') {
      await this.secrets.store(SECRET_KEY_OPENAI, key);
      return new OpenAIProvider(key, settings.ai.openAIModel);
    }
    await this.secrets.store(SECRET_KEY_GEMINI, key);
    return new GeminiProvider(key, settings.ai.geminiModel);
  }

  /** Every manually configured provider, in a fixed priority order — all of them, not just the first found. */
  private async getConfiguredManualProviders(aiSettings: CodoraSettings['ai']): Promise<AIProvider[]> {
    const providers: AIProvider[] = [];

    const anthropicKey = await this.secrets.get(SECRET_KEY_ANTHROPIC);
    if (anthropicKey) providers.push(new AnthropicProvider(anthropicKey, aiSettings.anthropicModel));

    const openaiKey = await this.secrets.get(SECRET_KEY_OPENAI);
    if (openaiKey) providers.push(new OpenAIProvider(openaiKey, aiSettings.openAIModel));

    const geminiKey = await this.secrets.get(SECRET_KEY_GEMINI);
    if (geminiKey) providers.push(new GeminiProvider(geminiKey, aiSettings.geminiModel));

    return providers;
  }
}
