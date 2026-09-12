import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import { CodoraController } from '../core/CodoraController';
import type { ChallengeToExtensionMessage, ExtensionToChallengeMessage } from '../../webview/shared/messages';
import { getLogger } from '../utils/logger';

export class ChallengeProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: CodoraController,
  ) {}

  async open(): Promise<void> {
    const question = await this.controller.generateChallenge();
    if (!question) {
      vscode.window.showInformationMessage('Codora: not enough project context yet for a good challenge.');
      return;
    }

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
    } else {
      this.panel.reveal(vscode.ViewColumn.Beside);
    }

    this.postQuestion(question);
  }

  private async handleMessage(message: ChallengeToExtensionMessage): Promise<void> {
    if (message.type === 'ready') return;
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
