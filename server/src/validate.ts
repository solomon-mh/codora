/**
 * The server's copy of the privacy contract in src/core/metrics/Metrics.ts.
 * Every event and every field is checked against an allow-list of names,
 * enums, booleans and bucketed numbers, and anything else is dropped. So
 * even a modified client can't store free text: there is no field here
 * that could hold code, a file name, a question or an answer.
 */

type FieldRule = readonly (string | number | boolean)[] | 'boolean';

const PROVIDERS = ['claude-cli', 'vscode-lm', 'anthropic', 'openai', 'gemini', 'unknown'] as const;
const KINDS = ['multiple-choice', 'free-text'] as const;
const CATEGORIES = ['recall', 'reasoning', 'debugging', 'architecture', 'testing', 'security', 'performance'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
const SCORE_BUCKETS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
const SECONDS_BUCKETS = [15, 30, 60, 120, 300, 999] as const;

export const EVENT_SCHEMA: Record<string, Record<string, FieldRule>> = {
  activated: {},
  opted_in: {},
  question_shown: {
    provider: PROVIDERS,
    kind: KINDS,
    category: CATEGORIES,
    difficulty: DIFFICULTIES,
    review: 'boolean',
    keyCheck: ['confirmed', 'unchecked', 'none'],
  },
  question_rejected: { verdict: ['disagreed', 'ambiguous'] },
  no_question: { reason: ['no_provider', 'all_failed'] },
  answered: {
    kind: KINDS,
    correct: 'boolean',
    scoreBucket: SCORE_BUCKETS,
    secondsBucket: SECONDS_BUCKETS,
    review: 'boolean',
  },
  abandoned: {},
  flagged: { reason: ['wrong-answer', 'unclear', 'not-relevant'], answered: 'boolean' },
};

export const MAX_EVENTS_PER_BATCH = 100;
const MAX_CLOCK_SKEW_MS = 7 * 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VERSION = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?(-[0-9A-Za-z.]{1,20})?$/;
const PLATFORMS = ['darwin', 'linux', 'win32'];

export interface CleanEvent {
  name: string;
  at: number;
  props: Record<string, string | number | boolean>;
}

export interface CleanBatch {
  installId: string;
  extensionVersion: string;
  vscodeVersion: string;
  platform: string;
  events: CleanEvent[];
}

/** A valid batch with any invalid events dropped, or undefined when the envelope itself is invalid. */
export function cleanBatch(raw: unknown, now: number): CleanBatch | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const body = raw as Record<string, unknown>;
  if (typeof body.installId !== 'string' || !UUID.test(body.installId)) return undefined;
  if (typeof body.extensionVersion !== 'string' || !VERSION.test(body.extensionVersion)) return undefined;
  if (typeof body.vscodeVersion !== 'string' || !VERSION.test(body.vscodeVersion)) return undefined;
  if (!Array.isArray(body.events) || body.events.length > MAX_EVENTS_PER_BATCH) return undefined;

  const platform = typeof body.platform === 'string' && PLATFORMS.includes(body.platform) ? body.platform : 'other';
  const events = body.events.map((e) => cleanEvent(e, now)).filter((e): e is CleanEvent => e !== undefined);
  return { installId: body.installId, extensionVersion: body.extensionVersion, vscodeVersion: body.vscodeVersion, platform, events };
}

export function cleanEvent(raw: unknown, now: number): CleanEvent | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const e = raw as Record<string, unknown>;
  if (typeof e.name !== 'string') return undefined;
  const schema = EVENT_SCHEMA[e.name];
  if (!schema) return undefined;
  if (typeof e.at !== 'number' || !Number.isFinite(e.at) || Math.abs(e.at - now) > MAX_CLOCK_SKEW_MS) return undefined;

  const rawProps = e.props && typeof e.props === 'object' ? (e.props as Record<string, unknown>) : {};
  // Exactly the schema's fields: no extras, none missing.
  if (Object.keys(rawProps).length !== Object.keys(schema).length) return undefined;
  const props: Record<string, string | number | boolean> = {};
  for (const [key, rule] of Object.entries(schema)) {
    const value = rawProps[key];
    const ok = rule === 'boolean' ? typeof value === 'boolean' : (rule as readonly unknown[]).includes(value);
    if (!ok) return undefined;
    props[key] = value as string | number | boolean;
  }
  return { name: e.name, at: Math.round(e.at), props };
}
