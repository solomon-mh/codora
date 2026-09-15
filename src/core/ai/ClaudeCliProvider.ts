import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildEvaluationPrompt, buildGenerationPrompt } from './prompts';
import { extractJsonObject, validateEvaluationPayload, validateGenerationPayload } from './parseAIResponse';
import { BaseAIProvider } from './BaseAIProvider';
import type {
  AIEvaluationContext,
  AIEvaluationPayload,
  AIGeneratedQuestionPayload,
  AIProvider,
  AIQuestionContext,
} from './AITypes';
import { getLogger } from '../../utils/logger';

/** A CLI round trip includes process startup, so it needs a longer budget than an HTTP call. */
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

/**
 * Denied so this stays a single-shot text transform. Codora hands the model
 * the exact snippet it should reason about, and an agentic run that reads
 * files or executes commands on its own would be slower, less predictable,
 * and would block on permission prompts that print mode can't answer.
 * A deny list is the fail-safe direction here: a tool name that doesn't
 * exist in some CLI version is simply ignored, whereas a typo'd allow list
 * could silently permit everything.
 */
const DENIED_TOOLS = [
  'Bash',
  'Edit',
  'Write',
  'Read',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
  'NotebookEdit',
  'Task',
  'TodoWrite',
];

/** Resolved CLI path, cached for the session once found (the lookup touches the filesystem). */
let cachedCliPath: string | undefined;

/**
 * Uses the Claude Code CLI as a question generator/evaluator, which runs on
 * the developer's existing Claude authentication — no API key to paste and
 * no separate per-token billing.
 *
 * This exists because the official Claude VS Code extension does not
 * publish a model through `vscode.lm` (its manifest contributes views and
 * commands only), so unlike GitHub Copilot Chat it cannot be borrowed via
 * the Language Model API. The CLI it bundles is the reachable surface.
 */
export class ClaudeCliProvider extends BaseAIProvider implements AIProvider {
  readonly id = 'claude-cli' as const;
  readonly label = 'Claude Code CLI';
  readonly vendor = 'anthropic' as const;
  /**
   * The CLI picks the model itself from the developer's own Claude
   * configuration and print mode doesn't report which one it used, so this
   * names the tool rather than claiming a specific model.
   */
  readonly modelName = 'Claude Code';

  constructor(private readonly cliPath: string) {
    super();
  }

  static resolve(): ClaudeCliProvider | undefined {
    const cliPath = findClaudeCli();
    return cliPath ? new ClaudeCliProvider(cliPath) : undefined;
  }

  async generateQuestion(ctx: AIQuestionContext): Promise<AIGeneratedQuestionPayload | undefined> {
    const { system, user } = buildGenerationPrompt(ctx);
    const text = await this.send(system, user);
    this.recordRawResponse(text);
    if (!text) return undefined;
    return validateGenerationPayload(extractJsonObject(text));
  }

  async evaluateFreeText(ctx: AIEvaluationContext): Promise<AIEvaluationPayload | undefined> {
    const { system, user } = buildEvaluationPrompt(ctx);
    const text = await this.send(system, user);
    this.recordRawResponse(text);
    if (!text) return undefined;
    return validateEvaluationPayload(extractJsonObject(text));
  }

  private send(system: string, user: string): Promise<string | undefined> {
    // execFile with an argument array — never a shell string — so nothing in
    // the prompt (which embeds the developer's code) can be interpreted as a
    // shell command. Runs in a temp directory rather than the workspace so
    // the CLI has no project to wander into: the snippet Codora supplies is
    // meant to be the whole context.
    const args = ['--print', `${system}\n\n${user}`, '--disallowed-tools', ...DENIED_TOOLS];

    return new Promise((resolve, reject) => {
      execFile(
        this.cliPath,
        args,
        { cwd: os.tmpdir(), timeout: REQUEST_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES },
        (error, stdout, stderr) => {
          if (error) {
            // stderr carries the useful part (auth/rate-limit messages); the
            // Error itself is usually just a non-zero exit code.
            const detail = stderr.trim() || error.message;
            reject(new Error(detail));
            return;
          }
          resolve(stdout.trim());
        },
      );
    });
  }
}

/** Extension host roots to search, covering VS Code stable, Insiders, and remote installs. */
function extensionRoots(): string[] {
  const home = os.homedir();
  return [
    path.join(home, '.vscode', 'extensions'),
    path.join(home, '.vscode-insiders', 'extensions'),
    path.join(home, '.vscode-server', 'extensions'),
  ];
}

/**
 * Picks the newest `anthropic.claude-code-*` directory name, comparing
 * version segments numerically so 2.1.269 beats 2.1.9 (plain lexicographic
 * sorting gets that backwards).
 */
export function pickNewestClaudeExtensionDir(names: string[]): string | undefined {
  return names
    .filter((name) => name.startsWith('anthropic.claude-code-'))
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
}

function isExecutableFile(candidate: string): boolean {
  try {
    if (!fs.statSync(candidate).isFile()) return false;
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findClaudeCli(): string | undefined {
  if (cachedCliPath && isExecutableFile(cachedCliPath)) return cachedCliPath;

  // A globally installed CLI is the supported, stable location, so prefer it.
  const exeName = process.platform === 'win32' ? 'claude.exe' : 'claude';
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, exeName);
    if (isExecutableFile(candidate)) {
      cachedCliPath = candidate;
      getLogger().info('Claude CLI found on PATH', { path: candidate });
      return candidate;
    }
  }

  // Otherwise fall back to the copy bundled inside the official Claude Code
  // extension. This reaches into another extension's internals, which is
  // NOT a public contract — a future version could move or drop it — so it
  // is deliberately last, version-globbed rather than pinned, and fails
  // soft to "no provider" if the layout changes.
  for (const root of extensionRoots()) {
    let entries: string[];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    const newest = pickNewestClaudeExtensionDir(entries);
    if (!newest) continue;
    const candidate = path.join(root, newest, 'resources', 'native-binary', exeName);
    if (isExecutableFile(candidate)) {
      cachedCliPath = candidate;
      getLogger().info('Claude CLI found bundled in the Claude Code extension', { path: candidate });
      return candidate;
    }
  }

  return undefined;
}
