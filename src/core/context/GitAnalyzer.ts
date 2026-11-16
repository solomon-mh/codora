import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getLogger } from '../../utils/logger';
import { parsePorcelainZ } from './parseGitStatus';

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
      run(['status', '--porcelain', '-z'], workspaceRoot),
      run(['log', '-1', '--pretty=%s'], workspaceRoot).catch(() => ''),
    ]);

    const changedFiles = parsePorcelainZ(statusOutput);

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

/**
 * Drops the paths git ignores (.gitignore, .git/info/exclude, the global
 * excludes file). Tracked files are never reported as ignored, so only
 * files git itself would leave out are removed. Without git, or if the
 * check fails, nothing is known to be ignored and every path is kept;
 * isSendableSourcePath still applies either way.
 */
export function filterGitIgnored(workspaceRoot: string, relativePaths: string[]): Promise<string[]> {
  if (relativePaths.length === 0 || !fs.existsSync(path.join(workspaceRoot, '.git'))) {
    return Promise.resolve(relativePaths);
  }
  return new Promise((resolve) => {
    const child = execFile(
      'git',
      ['check-ignore', '--stdin', '-z'],
      { cwd: workspaceRoot, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        // Exit code 1 means "none of these are ignored", not a failure.
        // At runtime `code` is the numeric exit status, though Node's types call it a string.
        if (error && (error as { code?: unknown }).code !== 1) {
          getLogger().warn('git check-ignore failed; keeping all candidate files', { error: String(error) });
          resolve(relativePaths);
          return;
        }
        const ignored = new Set(stdout.split('\0').filter(Boolean));
        resolve(relativePaths.filter((p) => !ignored.has(p)));
      },
    );
    child.stdin?.end(relativePaths.map((p) => `${p}\0`).join(''));
  });
}

/** Whether a .git/index.lock is present — used to avoid interrupting an in-progress git operation. */
export function isGitOperationInProgress(workspaceRoot: string): boolean {
  return fs.existsSync(path.join(workspaceRoot, '.git', 'index.lock'));
}
