import * as vscode from 'vscode';
import { initLogger, getLogger } from './utils/logger';
import { CodoraController } from './core/CodoraController';
import { SidebarProvider } from './providers/SidebarProvider';
import { DashboardProvider } from './providers/DashboardProvider';
import { ChallengeProvider } from './providers/ChallengeProvider';
import { OnboardingProvider } from './providers/OnboardingProvider';
import { shouldAvoidInterrupting } from './core/session/InterruptionGuard';
import { computeAura, auraLabel } from './core/scoring/ScoreEngine';

export function activate(context: vscode.ExtensionContext): void {
  const channel = vscode.window.createOutputChannel('Codora');
  initLogger(channel);
  getLogger().info('Codora activating');

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    getLogger().info('No workspace open — Codora will remain idle until a folder is opened');
    return;
  }

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'codora.openDashboard';
  context.subscriptions.push(statusBarItem);

  // `onChallengeReady` only runs later (on a session-manager timer tick),
  // so it's safe for its body to reference `challengeProvider` even though
  // that binding is declared further down — by call time it's assigned.
  function onChallengeReady(): void {
    const settings = controller.storage.getGlobalProfile().settings;
    if (shouldAvoidInterrupting(settings, workspaceFolder!.uri.fsPath)) {
      getLogger().debug('Challenge ready but suppressed (interruption guard)');
      return;
    }
    if (!settings.notifications.challenge) return;

    void vscode.window
      .showInformationMessage('🧠 Codora Challenge Ready — test your understanding?', 'Take Challenge', 'Later')
      .then((choice) => {
        if (choice === 'Take Challenge') {
          void challengeProvider.open();
        }
      });
  }

  const controller = new CodoraController(context, workspaceFolder, onChallengeReady);
  const challengeProvider = new ChallengeProvider(context.extensionUri, controller);

  const dashboardProvider = new DashboardProvider(context.extensionUri, controller, () => void challengeProvider.open());
  const sidebarProvider = new SidebarProvider(
    context.extensionUri,
    controller,
    () => void challengeProvider.open(),
    () => dashboardProvider.reveal(),
  );
  const onboardingProvider = new OnboardingProvider(context.extensionUri, controller);

  context.subscriptions.push(vscode.window.registerWebviewViewProvider('codora.sidebar', sidebarProvider));

  const updateStatusBar = () => {
    const global = controller.storage.getGlobalProfile();
    const totalSamples = Object.values(global.categoryScores).reduce((s, c) => s + c.sampleCount, 0);
    if (totalSamples === 0) {
      statusBarItem.text = '🧠 Codora';
    } else {
      statusBarItem.text = `🧠 Aura ${Math.round(computeAura(global.categoryScores))}`;
    }
    statusBarItem.show();
  };
  controller.onDidChangeState(updateStatusBar);
  updateStatusBar();

  context.subscriptions.push(
    vscode.commands.registerCommand('codora.openDashboard', () => dashboardProvider.reveal()),
    vscode.commands.registerCommand('codora.startChallenge', () => void challengeProvider.open()),
    vscode.commands.registerCommand('codora.startDeepChallenge', () => void challengeProvider.open()),
    vscode.commands.registerCommand('codora.pauseChallenges', async () => {
      await controller.pauseChallenges();
      vscode.window.showInformationMessage('Codora challenges paused.');
    }),
    vscode.commands.registerCommand('codora.resumeChallenges', async () => {
      await controller.resumeChallenges();
      vscode.window.showInformationMessage('Codora challenges resumed.');
    }),
    vscode.commands.registerCommand('codora.showAura', () => {
      const global = controller.storage.getGlobalProfile();
      const aura = computeAura(global.categoryScores);
      vscode.window.showInformationMessage(`Aura: ${Math.round(aura)} · ${auraLabel(aura)}`);
    }),
    vscode.commands.registerCommand('codora.showProgress', () => dashboardProvider.reveal()),
    vscode.commands.registerCommand('codora.resetProjectData', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Reset all Codora data for this project? This cannot be undone.',
        { modal: true },
        'Reset',
      );
      if (confirm === 'Reset') {
        await controller.resetProjectData();
        vscode.window.showInformationMessage('Codora project data reset.');
      }
    }),
    vscode.commands.registerCommand('codora.configureAI', () => void controller.configureAI()),
  );

  context.subscriptions.push(controller);

  controller.start();

  if (!controller.storage.getGlobalProfile().onboarded) {
    onboardingProvider.open();
  }

  getLogger().info('Codora activated', { project: workspaceFolder.name });
}

export function deactivate(): void {
  // All cleanup happens via context.subscriptions (controller.dispose()).
}
