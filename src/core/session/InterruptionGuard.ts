import * as vscode from 'vscode';
import { isGitOperationInProgress } from '../context/GitAnalyzer';
import type { CodoraSettings } from '../storage/StorageSchema';

const TEST_TASK_HINTS = ['test', 'jest', 'vitest', 'mocha', 'pytest'];

/**
 * Best-effort "don't interrupt" checks (spec section 11). Presentation
 * Mode has no VS Code detection API, so it is intentionally not checked
 * here — `doNotDisturb` is the manual equivalent users toggle themselves.
 */
export function shouldAvoidInterrupting(
  settings: CodoraSettings,
  workspaceRoot: string | undefined,
): boolean {
  if (settings.doNotDisturb) return true;

  if (settings.avoidInterrupting.debugging && vscode.debug.activeDebugSession) {
    return true;
  }

  if (settings.avoidInterrupting.testsRunning) {
    const runningTestTask = vscode.tasks.taskExecutions.some((exec) =>
      TEST_TASK_HINTS.some((hint) => exec.task.name.toLowerCase().includes(hint)),
    );
    if (runningTestTask) return true;
  }

  if (settings.avoidInterrupting.gitOperations && workspaceRoot && isGitOperationInProgress(workspaceRoot)) {
    return true;
  }

  return false;
}
