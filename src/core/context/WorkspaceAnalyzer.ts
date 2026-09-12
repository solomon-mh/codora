import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const EXCLUDE_GLOB = '**/{node_modules,dist,out,build,.git,vendor,__pycache__,.venv}/**';
const MAX_RECENT_FILES = 12;
const MAX_FILE_BYTES = 200_000;

export interface RecentFile {
  uri: vscode.Uri;
  relativePath: string;
  mtime: number;
}

export interface ProjectMetadata {
  name: string;
  languages: string[];
  configFilesFound: string[];
}

const CONFIG_FILES = [
  'package.json',
  'tsconfig.json',
  'composer.json',
  'requirements.txt',
  'pyproject.toml',
  'go.mod',
  'Cargo.toml',
];

/**
 * Finds a small, bounded set of recently-modified files rather than
 * walking the whole repository (spec section 15 — "do not read
 * everything").
 */
export async function findRecentlyModifiedFiles(
  workspaceFolder: vscode.WorkspaceFolder,
): Promise<RecentFile[]> {
  const uris = await vscode.workspace.findFiles(
    new vscode.RelativePattern(workspaceFolder, '**/*'),
    EXCLUDE_GLOB,
    500,
  );

  const withStats: RecentFile[] = [];
  for (const uri of uris) {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type !== vscode.FileType.File || stat.size > MAX_FILE_BYTES) continue;
      withStats.push({
        uri,
        relativePath: path.relative(workspaceFolder.uri.fsPath, uri.fsPath),
        mtime: stat.mtime,
      });
    } catch {
      // Skip files that vanish/are unreadable between listing and stat.
    }
  }

  withStats.sort((a, b) => b.mtime - a.mtime);
  return withStats.slice(0, MAX_RECENT_FILES);
}

export function readProjectMetadata(workspaceFolder: vscode.WorkspaceFolder): ProjectMetadata {
  const root = workspaceFolder.uri.fsPath;
  const configFilesFound = CONFIG_FILES.filter((f) => fs.existsSync(path.join(root, f)));
  const languages = detectLanguages(configFilesFound);

  return {
    name: workspaceFolder.name,
    languages,
    configFilesFound,
  };
}

function detectLanguages(configFiles: string[]): string[] {
  const languages = new Set<string>();
  if (configFiles.includes('package.json')) languages.add('JavaScript/TypeScript');
  if (configFiles.includes('requirements.txt') || configFiles.includes('pyproject.toml')) {
    languages.add('Python');
  }
  if (configFiles.includes('go.mod')) languages.add('Go');
  if (configFiles.includes('Cargo.toml')) languages.add('Rust');
  if (configFiles.includes('composer.json')) languages.add('PHP');
  return Array.from(languages);
}

export function languageFromExtension(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.cs': 'C#',
    '.cpp': 'C++',
    '.c': 'C',
  };
  return map[ext];
}
