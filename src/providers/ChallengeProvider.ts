import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import { CodoraController } from '../core/CodoraController';
import type {
  ChallengeToExtensionMessage,
  ChallengeUnavailable,
  ChallengeUnavailableAction,
  ExtensionToChallengeMessage,
} from '../../webview/shared/messages';
import type { GeneratedQuestion } from '../core/questions/QuestionTypes';
import { getLogger } from '../utils/logger';

/** What the panel should display once its webview signals 'ready'. */
type PendingView =
  | { kind: 'question'; question: GeneratedQuestion }
  | { kind: 'unavailable'; payload: ChallengeUnavailable };

const MAX_REASON_CHARS = 220;

/**
 * Provider errors are frequently a wall of JSON (a Gemini quota error is
 * ~1.5KB of nested detail). Pull out the human-readable `message` when the
 * error is JSON, and cap the length either way — the full text is always in
 * the output channel, which the panel links to.
 */
function summarizeReason(reason: string | undefined): string {
  if (!reason) return 'no usable question returned';

  let text = reason;
  const jsonStart = reason.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(reason.slice(jsonStart)) as { error?: { message?: string; status?: string } };
      const message = parsed.error?.message;
      if (message) {
        const prefix = reason.slice(0, jsonStart).trim();
        text = prefix ? `${prefix} ${message}` : message;
      }
    } catch {
      // Not JSON after all — fall through and just truncate the raw text.
    }
  }

  text = text.replace(/\s+/g, ' ').trim();
  return text.length > MAX_REASON_CHARS ? `${text.slice(0, MAX_REASON_CHARS)}…` : text;
}

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
          "Codora needs an AI model to write questions about your code. Use whatever you already have in VS Code (e.g. GitHub Copilot Chat), or add an Anthropic, OpenAI, or Gemini API key — it's stored locally in VS Code's secret storage.",
        action: { label: 'Configure AI Provider', kind: 'configure-ai' },
      };
    }

    // Report what the providers actually said, rather than guessing at the
    // cause — an exhausted quota and a model that won't return JSON need
    // very different responses from the user.
    const failures = this.controller.getLastAIFailures();
    const reported = failures
      .map((f) => `• ${f.provider}: ${summarizeReason(f.reason)}`)
      .join('\n');

    return {
      title: 'No provider could generate a challenge right now',
      detail: reported
        ? `Every configured AI provider was tried:\n\n${reported}\n\nNothing was asked rather than falling back to a canned question.`
        : 'Every configured AI provider was tried and none returned a usable question. This can also mean there were no meaningful recent code changes to ask about.',
      action: { label: 'Show Logs', kind: 'show-logs' },
    };
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
    }
  }

  private post(message: ExtensionToChallengeMessage): void {
    this.panel?.webview.postMessage(message);
  }
}
