import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import { CodoraController } from '../core/CodoraController';
import { buildDashboardState } from '../core/aggregation/DashboardData';
import type { DashboardToExtensionMessage, ExtensionToDashboardMessage } from '../../webview/shared/messages';

export class DashboardProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: CodoraController,
    private readonly onStartChallenge: () => void,
  ) {
    controller.onDidChangeState(() => this.postState());
  }

  reveal(): void {
    if (this.panel) {
      this.panel.reveal();
      this.postState();
      return;
    }

    this.panel = vscode.window.createWebviewPanel('codora.dashboard', 'Codora Dashboard', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
    });
    this.panel.webview.html = getWebviewHtml(this.panel.webview, this.extensionUri, 'dashboard', 'Codora Dashboard');

    this.panel.webview.onDidReceiveMessage((message: DashboardToExtensionMessage) => {
      switch (message.type) {
        case 'ready':
          this.postState();
          break;
        case 'startChallenge':
          this.onStartChallenge();
          break;
        case 'resetProjectData':
          void this.controller.resetProjectData();
          break;
        case 'updateSettings':
          void this.controller.updateSettings(message.payload);
          break;
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  private postState(): void {
    if (!this.panel) return;
    const global = this.controller.storage.getGlobalProfile();
    const project = this.controller.storage.getProjectData();
    const message: ExtensionToDashboardMessage = {
      type: 'state',
      payload: buildDashboardState(global, project, Date.now()),
    };
    this.panel.webview.postMessage(message);
  }
}
