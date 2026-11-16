import * as path from 'path';

/**
 * Which files Codora may read and send to a model. A snippet of the chosen
 * file goes to a third-party provider, so this is an allow-list: only
 * source code in a known language, never config, data, lock, key or
 * environment files (.env, .pem, package-lock.json, credentials.json…),
 * whatever their content.
 */
export const SOURCE_EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'svelte', 'astro',
  'py', 'go', 'rs', 'java', 'kt', 'kts', 'scala', 'groovy',
  'rb', 'php', 'cs', 'fs', 'swift', 'dart', 'm', 'mm',
  'c', 'h', 'cc', 'cpp', 'cxx', 'hh', 'hpp', 'hxx',
  'ex', 'exs', 'erl', 'hs', 'clj', 'cljs', 'elm', 'ml', 'jl', 'lua', 'r', 'zig', 'sol',
] as const;

const SOURCE_EXTENSION_SET = new Set<string>(SOURCE_EXTENSIONS);

/** A file name that suggests secrets is refused even with a source extension (secrets.ts, apiKeys.py, credentials.js). */
const SENSITIVE_NAME = /secret|credential|passw(or)?d|api[-_]?keys?|private[-_]?key/i;

/** Folders that hold keys or cloud credentials, or are never the developer's own code. */
const BLOCKED_DIRS = new Set([
  '.git', '.ssh', '.aws', '.gnupg', '.azure', '.kube', '.docker',
  'secrets', 'secret', 'credentials',
  'node_modules', 'vendor', 'dist', 'build', 'out', '__pycache__', '.venv', 'venv',
]);

/**
 * Whether a workspace-relative path may be read and sent to a model:
 * source code in a known language, outside key/credential/dependency
 * folders, and not named like a secrets file.
 */
export function isSendableSourcePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) return false;

  const fileName = segments[segments.length - 1];
  if (fileName.startsWith('.env')) return false;
  if (SENSITIVE_NAME.test(fileName)) return false;
  if (segments.slice(0, -1).some((dir) => BLOCKED_DIRS.has(dir.toLowerCase()))) return false;

  const ext = path.posix.extname(fileName).slice(1).toLowerCase();
  return SOURCE_EXTENSION_SET.has(ext);
}

/** A NUL byte in the first few KB means binary content, however the file is named. */
export function looksBinary(text: string): boolean {
  return text.slice(0, 8000).includes('\0');
}
