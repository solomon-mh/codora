import { describe, it, expect, vi } from 'vitest';
import { cleanBatch, cleanEvent } from '../../server/src/validate';

vi.mock('vscode', () => ({}));
type MetricEvent = import('../../src/core/metrics/Metrics').MetricEvent;

const NOW = 1_800_000_000_000;

/** One of every event the extension can send — typed against the client's contract. */
const CLIENT_EVENTS: MetricEvent[] = [
  { name: 'activated' },
  { name: 'opted_in' },
  { name: 'question_shown', provider: 'claude-cli', kind: 'multiple-choice', category: 'reasoning', difficulty: 'medium', review: true, keyCheck: 'confirmed' },
  { name: 'question_rejected', verdict: 'disagreed' },
  { name: 'no_question', reason: 'all_failed' },
  { name: 'answered', kind: 'free-text', correct: false, scoreBucket: 40, secondsBucket: 60, review: false },
  { name: 'abandoned' },
  { name: 'flagged', reason: 'wrong-answer', answered: true },
];

const asQueued = (e: MetricEvent) => {
  const { name, ...props } = e;
  return { name, at: NOW, props };
};

describe('server event validation', () => {
  it('accepts every event the extension can send', () => {
    for (const event of CLIENT_EVENTS) {
      expect(cleanEvent(asQueued(event), NOW), event.name).toEqual(asQueued(event));
    }
  });

  it('drops any field that could carry text', () => {
    const leaky = { name: 'answered', at: NOW, props: { kind: 'free-text', correct: true, scoreBucket: 90, secondsBucket: 30, review: false, answer: 'my code does X' } };
    expect(cleanEvent(leaky, NOW)).toBeUndefined();
    const freeTextValue = { name: 'question_shown', at: NOW, props: { ...asQueued(CLIENT_EVENTS[2]).props, category: 'src/secret/file.ts' } };
    expect(cleanEvent(freeTextValue, NOW)).toBeUndefined();
  });

  it('drops unknown events and exact scores, and rejects a malformed envelope', () => {
    expect(cleanEvent({ name: 'keystroke', at: NOW, props: {} }, NOW)).toBeUndefined();
    // Names that exist on every object's prototype chain must not slip through.
    for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      expect(cleanEvent({ name, at: NOW, props: {} }, NOW), name).toBeUndefined();
    }
    expect(cleanEvent({ ...asQueued(CLIENT_EVENTS[5]), props: { ...asQueued(CLIENT_EVENTS[5]).props, scoreBucket: 47 } }, NOW)).toBeUndefined();
    expect(cleanBatch({ installId: 'not-a-uuid', extensionVersion: '0.2.0', vscodeVersion: '1.106', events: [] }, NOW)).toBeUndefined();
  });

  it('keeps the valid events of a batch and drops the rest', () => {
    const batch = cleanBatch(
      {
        installId: '3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b',
        extensionVersion: '0.2.0',
        vscodeVersion: '1.106',
        platform: 'linux',
        events: [asQueued(CLIENT_EVENTS[0]), { name: 'keystroke', at: NOW, props: {} }],
      },
      NOW,
    );
    expect(batch?.events.map((e) => e.name)).toEqual(['activated']);
  });
});
