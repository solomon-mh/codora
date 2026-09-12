import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import { CodoraController } from '../core/CodoraController';
import type {
  ChallengeSetupOption,
  ChallengeToExtensionMessage,
  ChallengeUnavailable,
  ChallengeUnavailableAction,
  ExtensionToChallengeMessage,
} from '../../webview/shared/messages';
import type { ManualProviderId } from '../core/ai/AIProviderResolver';
import { summarizeProviderError } from '../core/ai/summarizeProviderError';
import type { GeneratedQuestion } from '../core/questions/QuestionTypes';
import { getLogger } from '../utils/logger';

/** What the panel should display once its webview signals 'ready'. */
type PendingView =
  | { kind: 'question'; question: GeneratedQuestion }
  | { kind: 'unavailable'; payload: ChallengeUnavailable };

/** Maps a panel setup button to the provider AIProviderResolver should configure. */
const SETUP_TARGETS = {
  'setup-vscode-lm': 'vscode-lm',
  'setup-anthropic': 'anthropic',
  'setup-openai': 'openai',
  'setup-gemini': 'gemini',
} as const satisfies Record<string, ManualProviderId | 'vscode-lm'>;

export class ChallengeProvider {
  private panel: vscode.WebviewPanel | undefined;
  private pendingView: PendingView | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: CodoraController,
  ) {}

  async open(): Promise<void> {
    const question = await this.controller.generateChallenge();
    // Question generation is AI-only, so "no question" is a normal,
    // explainable outcome rather than an error — it gets shown in the panel
    // where the question would be, with the action that fixes it.
    this.show(question ? { kind: 'question', question } : { kind: 'unavailable', payload: await this.describeUnavailable() });
  }

  private show(view: PendingView): void {
    this.pendingView = view;

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'codora.challenge',
        'Codora Challenge',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: false },
        { enableScripts: true, retainContextWhenHidden: true },
      );
      this.panel.webview.html = getWebviewHtml(this.panel.webview, this.extensionUri, 'challenge', 'Codora Challenge');
      this.panel.webview.onDidReceiveMessage((message: ChallengeToExtensionMessage) => this.handleMessage(message));
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.pendingView = undefined;
      });
      // Don't post yet: the webview's page hasn't loaded and attached its
      // message listener at this point, so a message sent now would be
      // silently dropped. It sends 'ready' once it's actually listening.
      return;
    }

    // An existing, already-loaded webview won't re-fire 'ready' just
    // because it's revealed again, so post directly here instead.
    this.panel.reveal(vscode.ViewColumn.Beside);
    this.postPendingView();
  }

  private postPendingView(): void {
    const view = this.pendingView;
    if (!view) return;
    if (view.kind === 'question') {
      this.post({ type: 'question', payload: view.question });
    } else {
      this.post({ type: 'unavailable', payload: view.payload });
    }
  }

  /**
   * Turns "no question could be generated" into the specific cause plus the
   * action that resolves it. The three cases look identical to a user
   * otherwise, but need completely different fixes: AI switched off in
   * settings, no provider configured at all, or configured providers that
   * all failed (an exhausted quota being the common one).
   */
  private async describeUnavailable(): Promise<ChallengeUnavailable> {
    const status = await this.controller.getAIStatus();

    if (status === 'disabled') {
      return {
        title: 'AI-assisted challenges are turned off',
        detail:
          'Codora only asks questions an AI model actually derived from your code, so it has nothing to ask while AI is disabled. Re-enable it in Settings to start getting challenges again.',
        action: { label: 'Open Settings', kind: 'open-settings' },
      };
    }

    if (status === 'none-configured') {
      return {
        title: 'No AI provider configured',
        detail:
          "Codora needs an AI model to write questions about your code. If you have Claude Code installed, it's picked up automatically with no key needed — otherwise pick one below. Keys are stored in VS Code's secret storage, never in settings and never logged.",
        setupOptions: await this.buildSetupOptions(),
      };
    }

    // Report what the providers actually said, rather than guessing at the
    // cause — an exhausted quota and a model that won't return JSON need
    // very different responses from the user.
    const failures = this.controller.getLastAIFailures();
    const reported = failures
      .map((f) => `• ${f.provider}: ${summarizeProviderError(f.reason)}`)
      .join('\n');

    return {
      title: 'No provider could generate a challenge right now',
      detail: reported
        ? `Every configured AI provider was tried:\n\n${reported}\n\nNothing was asked rather than falling back to a canned question. If a quota is exhausted, adding another provider below will get you unblocked.`
        : 'Every configured AI provider was tried and none returned a usable question. This can also mean there were no meaningful recent code changes to ask about.',
      action: { label: 'Show Logs', kind: 'show-logs' },
      // Offered here too: when the failure is an exhausted quota, adding a
      // different provider is the actual fix, and it should be reachable
      // without hunting for a command.
      setupOptions: await this.buildSetupOptions(),
    };
  }

  /**
   * The provider choices rendered in the panel. Clicking one goes straight
   * to that provider's setup — for a manual key that means VS Code's
   * native masked input box, so the key never passes through the webview.
   */
  private async buildSetupOptions(): Promise<ChallengeSetupOption[]> {
    const configured = new Set((await this.controller.aiResolver.resolveCandidates()).map((p) => p.id));

    return [
      {
        label: 'Use AI already in VS Code',
        hint: 'Claude Code, GitHub Copilot Chat, or any extension publishing a chat model — no key needed',
        kind: 'setup-vscode-lm',
        alreadyConfigured: configured.has('vscode-lm'),
      },
      {
        label: 'Anthropic API key',
        hint: 'Claude models · console.anthropic.com',
        kind: 'setup-anthropic',
        alreadyConfigured: configured.has('anthropic'),
      },
      {
        label: 'OpenAI API key',
        hint: 'GPT models · platform.openai.com',
        kind: 'setup-openai',
        alreadyConfigured: configured.has('openai'),
      },
      {
        label: 'Gemini API key',
        hint: 'Google AI Studio · aistudio.google.com',
        kind: 'setup-gemini',
        alreadyConfigured: configured.has('gemini'),
      },
    ];
  }

  private async handleMessage(message: ChallengeToExtensionMessage): Promise<void> {
    if (message.type === 'ready') {
      this.postPendingView();
      return;
    }
    if (message.type === 'close') {
      this.panel?.dispose();
      return;
    }
    if (message.type === 'retry') {
      await this.open();
      return;
    }
    if (message.type === 'action') {
      await this.runUnavailableAction(message.payload);
      return;
    }
    if (message.type === 'submitAnswer') {
      try {
        const result = await this.controller.submitAnswer(message.payload);
        this.post({
          type: 'result',
          payload: { evaluation: result.evaluation, auraDelta: result.auraDelta },
        });
        if (result.followUp) {
          this.pendingView = { kind: 'question', question: result.followUp };
          setTimeout(() => this.post({ type: 'followUp', payload: result.followUp! }), 1200);
        }
      } catch (err) {
        getLogger().error('Failed to submit answer', { error: String(err) });
      }
    }
  }

  private async runUnavailableAction(action: ChallengeUnavailableAction): Promise<void> {
    switch (action) {
      case 'configure-ai':
        await vscode.commands.executeCommand('codora.configureAI');
        // Configuring a provider is the fix for this panel's current state,
        // so re-run generation immediately rather than making the user
        // trigger another challenge by hand.
        await this.open();
        return;
      case 'open-settings':
        await vscode.commands.executeCommand('codora.openDashboard');
        return;
      case 'show-logs':
        await vscode.commands.executeCommand('codora.showOutput');
        return;
      case 'setup-vscode-lm':
      case 'setup-anthropic':
      case 'setup-openai':
      case 'setup-gemini': {
        const target = SETUP_TARGETS[action];
        const provider = await this.controller.aiResolver.setUpProvider(target);
        // Only retry if setup actually produced a provider — otherwise the
        // user cancelled the input box, and immediately re-running would
        // just replace this panel's message with an identical one.
        if (provider) await this.open();
        return;
      }
    }
  }

  private post(message: ExtensionToChallengeMessage): void {
    this.panel?.webview.postMessage(message);
  }
}
