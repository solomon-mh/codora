import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { newId } from '../../utils/id';
import { languageFromExtension } from '../context/WorkspaceAnalyzer';
import type { ChallengeInterval } from '../storage/StorageSchema';
import type { LiveSessionState, SessionRecord } from './SessionState';
import { getLogger } from '../../utils/logger';

const TICK_MS = 15_000;
const IDLE_GAP_MS = 2 * 60_000;

const INTERVAL_MS: Record<Exclude<ChallengeInterval, 'off' | 'adaptive'>, number> = {
  '10min': 10 * 60_000,
  '30min': 30 * 60_000,
  '1hour': 60 * 60_000,
};

/** Adaptive is a real but deliberately simple first pass (spec section 10/13/31). */
const ADAPTIVE_DEFAULT_MS = 25 * 60_000;

export interface SessionManagerCallbacks {
  onChallengeReady: () => void;
  getChallengeInterval: () => ChallengeInterval;
  isPaused: () => boolean;
}

/**
 * Tracks active coding time via high-level signals only (document edits,
 * saves, git-state changes) — never keystrokes (spec section 9). Idle time
 * is excluded from the active-time accumulator so "10 min code + 20 min
 * idle + 10 min code" correctly reads as 20 minutes active, not 40.
 */
export class SessionManager implements vscode.Disposable {
  private live: LiveSessionState | null = null;
  private timer: NodeJS.Timeout | undefined;
  private disposables: vscode.Disposable[] = [];
  private gitWatcher: fs.FSWatcher | undefined;
  private completedSessions: SessionRecord[] = [];

  constructor(
    private readonly workspaceFolder: vscode.WorkspaceFolder,
    private readonly callbacks: SessionManagerCallbacks,
  ) {}

  start(): void {
    this.beginSession();

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onActivity(e.document.uri, 'edit')),
      vscode.workspace.onDidSaveTextDocument((doc) => this.onActivity(doc.uri, 'save')),
      vscode.window.onDidOpenTerminal(() => this.touchActivity()),
    );

    // Best-effort shell-execution signal — guarded because this API only
    // exists on newer VS Code versions than our minimum engine target.
    const win = vscode.window as unknown as {
      onDidStartTerminalShellExecution?: (listener: () => void) => vscode.Disposable;
    };
    if (typeof win.onDidStartTerminalShellExecution === 'function') {
      this.disposables.push(win.onDidStartTerminalShellExecution(() => this.touchActivity()));
    }

    this.watchGitState();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  dispose(): void {
    this.endSession();
    this.timer && clearInterval(this.timer);
    this.gitWatcher?.close();
    this.disposables.forEach((d) => d.dispose());
  }

  getCompletedSessions(): SessionRecord[] {
    return this.completedSessions;
  }

  /** Snapshot of active ms in the current in-progress session, for UI display. */
  getCurrentActiveMs(): number {
    return this.live?.activeMs ?? 0;
  }

  private beginSession(): void {
    this.live = {
      id: newId(),
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      activeMs: 0,
      msSinceLastChallenge: 0,
      filesTouched: new Set(),
      languages: new Set(),
      meaningfulChanges: 0,
      gitChangesDetected: false,
    };
  }

  private endSession(): void {
    if (!this.live) return;
    this.completedSessions.push({
      id: this.live.id,
      startedAt: this.live.startedAt,
      endedAt: Date.now(),
      activeMs: this.live.activeMs,
      filesTouched: Array.from(this.live.filesTouched),
      languages: Array.from(this.live.languages),
      meaningfulChanges: this.live.meaningfulChanges,
      gitChangesDetected: this.live.gitChangesDetected,
    });
    this.live = null;
  }

  private onActivity(uri: vscode.Uri, kind: 'edit' | 'save'): void {
    if (!isInWorkspace(uri, this.workspaceFolder)) return;
    this.touchActivity();
    if (!this.live) return;
    this.live.filesTouched.add(vscode.workspace.asRelativePath(uri, false));
    const lang = languageFromExtension(uri.fsPath);
    if (lang) this.live.languages.add(lang);
    if (kind === 'save') this.live.meaningfulChanges++;
  }

  private touchActivity(): void {
    if (!this.live) this.beginSession();
    this.live!.lastActivityAt = Date.now();
  }

  private watchGitState(): void {
    const gitDir = path.join(this.workspaceFolder.uri.fsPath, '.git');
    if (!fs.existsSync(gitDir)) return;
    try {
      this.gitWatcher = fs.watch(gitDir, { persistent: false }, (_event, filename) => {
        if (filename === 'HEAD' || filename === 'index') {
          this.touchActivity();
          if (this.live) this.live.gitChangesDetected = true;
        }
      });
    } catch (err) {
      getLogger().debug('Could not watch .git directory', { error: String(err) });
    }
  }

  private tick(): void {
    if (!this.live) return;
    const gap = Date.now() - this.live.lastActivityAt;

    // Only the ticks that fall within the idle-gap window since the last
    // real activity count as active coding time — once the gap exceeds the
    // threshold, further ticks are idle and contribute nothing, so a long
    // idle stretch is genuinely excluded rather than averaged in.
    if (gap <= IDLE_GAP_MS) {
      this.live.activeMs += TICK_MS;
      this.live.msSinceLastChallenge += TICK_MS;
    }

    this.maybeFireChallenge();
  }

  private maybeFireChallenge(): void {
    if (!this.live || this.callbacks.isPaused()) return;
    const interval = this.callbacks.getChallengeInterval();
    if (interval === 'off') return;

    const thresholdMs = interval === 'adaptive' ? ADAPTIVE_DEFAULT_MS : INTERVAL_MS[interval];
    if (this.live.msSinceLastChallenge >= thresholdMs) {
      this.live.msSinceLastChallenge = 0;
      this.callbacks.onChallengeReady();
    }
  }
}

function isInWorkspace(uri: vscode.Uri, folder: vscode.WorkspaceFolder): boolean {
  return uri.fsPath.startsWith(folder.uri.fsPath);
}
