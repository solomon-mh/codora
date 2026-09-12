/**
 * Codora logger. Callers must pass metadata objects, never raw file
 * contents, secrets, tokens, or full AI-instruction-file text (spec
 * section 52) — this module has no way to redact free-form strings, so the
 * discipline lives at the call site.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export class Logger {
  private minLevel: LogLevel = 'info';

  constructor(private readonly channel: { appendLine(msg: string): void }) {}

  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
    this.channel.appendLine(`[${level.toUpperCase()}] ${message}${suffix}`);
  }
}

let instance: Logger | undefined;

export function initLogger(channel: { appendLine(msg: string): void }): Logger {
  instance = new Logger(channel);
  return instance;
}

export function getLogger(): Logger {
  if (!instance) {
    throw new Error('Logger not initialized');
  }
  return instance;
}
