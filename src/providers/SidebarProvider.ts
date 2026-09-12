import * as vscode from 'vscode';
import { getWebviewHtml } from './webviewHtml';
import { CodoraController } from '../core/CodoraController';
import { buildSidebarState } from '../core/aggregation/DashboardData';
import type { ExtensionToSidebarMessage, SidebarToExtensionMessage } from '../../webview/shared/messages';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly controller: CodoraController,
    private readonly onStartChallenge: () => void,
    private readonly onOpenDashboard: () => void,
  ) {
    controller.onDidChangeState(() => this.postState());
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri, 'sidebar', 'Codora');

    webviewView.webview.onDidReceiveMessage((message: SidebarToExtensionMessage) => {
      switch (message.type) {
        case 'ready':
          this.postState();
          break;
        case 'openDashboard':
          this.onOpenDashboard();
          break;
        case 'startChallenge':
          this.onStartChallenge();
          break;
      }
    });
  }

  refresh(): void {
    this.postState();
  }

  private postState(): void {
    if (!this.view) return;
    const global = this.controller.storage.getGlobalProfile();
    const project = this.controller.storage.getProjectData();
    const message: ExtensionToSidebarMessage = { type: 'state', payload: buildSidebarState(global, project) };
    this.view.webview.postMessage(message);
  }
}
