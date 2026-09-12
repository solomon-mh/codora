import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import { CodoraController } from '../core/CodoraController';
import type { ChallengeToExtensionMessage, ExtensionToChallengeMessage } from '../../webview/shared/messages';
import { getLogger } from '../utils/logger';

export class ChallengeProvider {
  private panel: vscode.WebviewPanel | undefined;
  private currentQuestion: import('../core/questions/QuestionTypes').GeneratedQuestion | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: CodoraController,
  ) {}

  async open(): Promise<void> {
    const question = await this.controller.generateChallenge();
    if (!question) {
      // There is deliberately no local-template fallback, so "no question"
      // needs to say which of the possible causes it was and offer the
      // action that fixes it, rather than a vague "not enough context".
      await this.explainNoChallenge();
      return;
    }
    this.currentQuestion = question;

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
      });
      // Don't post yet: the webview's page hasn't loaded and attached its
      // message listener at this point, so a message sent now would be
      // silently dropped. It sends 'ready' once it's actually listening.
    } else {
      // An existing, already-loaded webview won't re-fire 'ready' just
      // because it's revealed again, so post directly here instead.
      this.panel.reveal(vscode.ViewColumn.Beside);
      this.postQuestion(question);
    }
  }

  /**
   * Explains why no challenge could be offered, and offers the action that
   * resolves it. Codora only asks questions an AI model actually derived
   * from the code, so "no AI available" means "no challenge" — and the
   * user needs to know which case they're in rather than seeing a generic
   * message that looks the same whether AI is unconfigured, out of quota,
   * or the workspace simply has nothing to ask about.
   */
  private async explainNoChallenge(): Promise<void> {
    const status = await this.controller.getAIStatus();

    if (status === 'disabled') {
      const choice = await vscode.window.showWarningMessage(
        'Codora: AI-assisted challenges are turned off, and Codora only asks questions an AI model derived from your code — so no challenge can be offered. Turn it back on in Settings.',
        'Open Settings',
      );
      if (choice === 'Open Settings') await vscode.commands.executeCommand('codora.openDashboard');
      return;
    }

    if (status === 'none-configured') {
      const choice = await vscode.window.showWarningMessage(
        'Codora: no AI provider is configured, so there is nothing to generate a challenge with. Configure one to start getting challenges.',
        'Configure AI Provider',
      );
      if (choice === 'Configure AI Provider') await vscode.commands.executeCommand('codora.configureAI');
      return;
    }

    const choice = await vscode.window.showWarningMessage(
      'Codora: none of your configured AI providers could produce a challenge right now (for example an exhausted quota, or no meaningful recent code changes to ask about). Nothing was asked rather than falling back to a canned question.',
      'Show Details',
    );
    if (choice === 'Show Details') await vscode.commands.executeCommand('codora.showOutput');
  }

  private async handleMessage(message: ChallengeToExtensionMessage): Promise<void> {
    if (message.type === 'ready') {
      if (this.currentQuestion) this.postQuestion(this.currentQuestion);
      return;
    }
    if (message.type === 'close') {
      this.panel?.dispose();
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
          this.currentQuestion = result.followUp;
          setTimeout(() => this.post({ type: 'followUp', payload: result.followUp! }), 1200);
        }
      } catch (err) {
        getLogger().error('Failed to submit answer', { error: String(err) });
      }
    }
  }

  private postQuestion(question: import('../core/questions/QuestionTypes').GeneratedQuestion): void {
    this.post({ type: 'question', payload: question });
  }

  private post(message: ExtensionToChallengeMessage): void {
    this.panel?.webview.postMessage(message);
  }
}
