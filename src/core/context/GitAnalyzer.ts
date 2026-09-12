import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from '../../utils/logger';

export interface GitContext {
  available: true;
  diff: string;
  changedFiles: string[];
  lastCommitMessage: string | null;
}

export interface GitUnavailable {
  available: false;
}

const MAX_DIFF_CHARS = 8000;

function run(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // execFile with an argument array — never shell string interpolation —
    // so nothing in a repo's file/branch names can inject a shell command
    // (spec section 53).
    execFile('git', args, { cwd, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

export async function analyzeGit(workspaceRoot: string): Promise<GitContext | GitUnavailable> {
  const gitDir = path.join(workspaceRoot, '.git');
  if (!fs.existsSync(gitDir)) {
    return { available: false };
  }

  try {
    const [diff, statusOutput, logOutput] = await Promise.all([
      run(['diff', 'HEAD'], workspaceRoot),
      run(['status', '--porcelain'], workspaceRoot),
      run(['log', '-1', '--pretty=%s'], workspaceRoot).catch(() => ''),
    ]);

    const changedFiles = statusOutput
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.slice(3).trim())
      .filter(Boolean);

    return {
      available: true,
      diff: diff.slice(0, MAX_DIFF_CHARS),
      changedFiles,
      lastCommitMessage: logOutput.trim() || null,
    };
  } catch (err) {
    getLogger().warn('Git context unavailable', { error: String(err) });
    return { available: false };
  }
}

/** Whether a .git/index.lock is present — used to avoid interrupting an in-progress git operation. */
export function isGitOperationInProgress(workspaceRoot: string): boolean {
  return fs.existsSync(path.join(workspaceRoot, '.git', 'index.lock'));
}
