import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import { getLogger } from '../../utils/logger';

/**
 * Where anonymous usage counts go: the Cloudflare Worker in /server.
 * Empty until that Worker is deployed — while it's empty, nothing is ever
 * sent, whatever the setting says. See server/README.md.
 */
export const METRICS_ENDPOINT = '';

const INSTALL_ID_KEY = 'codora.metrics.installId';
const FLUSH_INTERVAL_MS = 60_000;
const MAX_QUEUE = 100;

/**
 * Every event Codora can send, and every field on it. This list *is* the
 * privacy contract: only enums, booleans and coarse numbers — never code,
 * file or function names, questions, answers, feedback, model output or
 * anything typed. Adding a field here is a privacy decision.
 */
export type MetricEvent =
  | { name: 'activated' }
  | { name: 'opted_in' }
  | {
      name: 'question_shown';
      provider: string;
      kind: 'multiple-choice' | 'free-text';
      category: string;
      difficulty: string;
      review: boolean;
      keyCheck: 'confirmed' | 'unchecked' | 'none';
    }
  | { name: 'question_rejected'; verdict: 'disagreed' | 'ambiguous' }
  | { name: 'no_question'; reason: 'no_provider' | 'all_failed' }
  | {
      name: 'answered';
      kind: 'multiple-choice' | 'free-text';
      correct: boolean;
      /** Score rounded down to a tenth: 0, 10, … 100. */
      scoreBucket: number;
      /** Seconds to answer, bucketed: 15, 30, 60, 120, 300 or 999 (longer). */
      secondsBucket: number;
      review: boolean;
    }
  | { name: 'abandoned' }
  | { name: 'flagged'; reason: 'wrong-answer' | 'unclear' | 'not-relevant'; answered: boolean };

interface QueuedEvent {
  name: string;
  at: number;
  props: Record<string, string | number | boolean>;
}

/**
 * Opt-in, anonymous usage counts — so it's possible to know whether people
 * answer questions or dismiss them, how often a question is reported as
 * wrong, and whether anyone comes back after a week.
 *
 * Sends only when all three hold: the developer turned it on in Codora,
 * VS Code's own telemetry setting allows it, and an endpoint is configured.
 * The install id is a random UUID created on opt-in and deleted on opt-out;
 * nothing ties it to a person, machine or workspace.
 */
export class Metrics implements vscode.Disposable {
  private queue: QueuedEvent[] = [];
  private readonly timer: NodeJS.Timeout;

  constructor(
    private readonly globalState: vscode.Memento,
    private readonly isOptedIn: () => boolean,
    private readonly extensionVersion: string,
  ) {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  private get active(): boolean {
    return METRICS_ENDPOINT !== '' && this.isOptedIn() && vscode.env.isTelemetryEnabled;
  }

  track(event: MetricEvent): void {
    if (!this.active) return;
    const { name, ...props } = event;
    this.queue.push({ name, at: Date.now(), props });
    if (this.queue.length > MAX_QUEUE) this.queue.shift();
  }

  /** Called when the developer turns sharing on or off. Off forgets the install id and anything queued. */
  async setOptedIn(on: boolean): Promise<void> {
    if (on) {
      if (!this.globalState.get<string>(INSTALL_ID_KEY)) await this.globalState.update(INSTALL_ID_KEY, randomUUID());
      this.track({ name: 'opted_in' });
    } else {
      this.queue = [];
      await this.globalState.update(INSTALL_ID_KEY, undefined);
    }
  }

  async flush(): Promise<void> {
    const installId = this.globalState.get<string>(INSTALL_ID_KEY);
    if (!this.active || !installId || this.queue.length === 0) return;
    const events = this.queue;
    this.queue = [];
    try {
      const res = await fetch(`${METRICS_ENDPOINT}/v1/events`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          installId,
          extensionVersion: this.extensionVersion,
          vscodeVersion: vscode.version.split('.').slice(0, 2).join('.'),
          platform: process.platform,
          events,
        }),
      });
      if (!res.ok) getLogger().warn('Usage counts were not accepted', { status: res.status });
    } catch (err) {
      // Never retried or persisted: losing a batch of counts is fine.
      getLogger().warn('Could not send usage counts', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  dispose(): void {
    clearInterval(this.timer);
    void this.flush();
  }
}

export function scoreBucket(score0to1: number): number {
  return Math.min(100, Math.floor(score0to1 * 10) * 10);
}

export function secondsBucket(ms: number): number {
  const s = ms / 1000;
  for (const edge of [15, 30, 60, 120, 300]) if (s <= edge) return edge;
  return 999;
}
