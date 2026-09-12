import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import { CodoraController } from '../core/CodoraController';
import type { OnboardingToExtensionMessage } from '../../webview/shared/messages';

export class OnboardingProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: CodoraController,
  ) {}

  open(): void {
    const panel = vscode.window.createWebviewPanel(
      'codora.onboarding',
      'Welcome to Codora',
      vscode.ViewColumn.One,
      { enableScripts: true },
    );
    panel.webview.html = getWebviewHtml(panel.webview, this.extensionUri, 'onboarding', 'Welcome to Codora');

    panel.webview.onDidReceiveMessage(async (message: OnboardingToExtensionMessage) => {
      if (message.type === 'complete') {
        await this.controller.updateSettings({
          challengeInterval: message.payload.challengeInterval,
          categories: message.payload.categories,
        });
        await this.controller.storage.updateGlobalProfile((p) => ({ ...p, onboarded: true }));
        panel.dispose();
      }
    });
  }
}
