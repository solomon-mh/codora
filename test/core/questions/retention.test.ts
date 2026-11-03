import { describe, it, expect } from 'vitest';
import { dueForReview, nextIntervalDays } from '../../../src/core/questions/retention';
import { applyAnswer, replayRollingScores } from '../../../src/core/scoring/ScoreEngine';
import { createDefaultRollingScores } from '../../../src/core/scoring/ScoreTypes';
import type { ChallengeRecord, FlagReason } from '../../../src/core/questions/QuestionTypes';

const DAY = 24 * 60 * 60 * 1000;

function record(
  file: string,
  fn: string | undefined,
  correct: boolean,
  answeredAt: number,
  extra: { review?: boolean; flagged?: FlagReason } = {},
): ChallengeRecord {
  return {
    question: {
      id: `q${answeredAt}`,
      type: 'recall',
      isRetentionCheck: extra.review ?? false,
      provenance: { sourceFiles: [file], subjectFunction: fn },
    },
    answer: { answeredAt },
    evaluation: { score: correct ? 1 : 0, correct },
    flagged: extra.flagged,
  } as unknown as ChallengeRecord;
}

describe('spaced review schedule', () => {
  it('waits 7, 21 then 60 days after a run of correct answers, and 3 days after a miss', () => {
    expect(nextIntervalDays([record('a.ts', 'f', true, 0)])).toBe(7);
    expect(nextIntervalDays([record('a.ts', 'f', true, 0), record('a.ts', 'f', true, 1)])).toBe(21);
    expect(nextIntervalDays([0, 1, 2, 3].map((t) => record('a.ts', 'f', true, t)))).toBe(60);
    expect(nextIntervalDays([record('a.ts', 'f', true, 0), record('a.ts', 'f', false, 1)])).toBe(3);
  });

  it('marks a subject due once its interval has passed, most overdue first', () => {
    const now = 100 * DAY;
    const due = dueForReview(
      [
        record('fresh.ts', 'f', true, now - 2 * DAY), // 7-day interval, not due
        record('due.ts', 'g', true, now - 8 * DAY), // 7-day interval, 8 days ago
        record('missed.ts', 'h', false, now - 9 * DAY), // 3-day interval, 3x overdue
      ],
      now,
    );
    expect(due.map((d) => d.file)).toEqual(['missed.ts', 'due.ts']);
    expect(due[0].subjectFunction).toBe('h');
  });

  it('ignores answers the developer reported', () => {
    const now = 100 * DAY;
    expect(dueForReview([record('a.ts', 'f', true, now - 30 * DAY, { flagged: 'unclear' })], now)).toEqual([]);
  });
});

describe('retention scoring', () => {
  it('scores a review question toward retention as well as its own category', () => {
    const scores = applyAnswer(createDefaultRollingScores(), { type: 'recall', isRetentionCheck: true }, 1, 0);
    expect(scores.recall.sampleCount).toBe(1);
    expect(scores.retention.sampleCount).toBe(1);
  });

  it('leaves retention alone for a first-time question', () => {
    const scores = applyAnswer(createDefaultRollingScores(), { type: 'recall', isRetentionCheck: false }, 1, 0);
    expect(scores.retention.sampleCount).toBe(0);
  });

  it('takes a reported answer back out when scores are replayed', () => {
    const kept = record('a.ts', 'f', true, 1);
    const reported = record('a.ts', 'f', false, 2, { flagged: 'wrong-answer' });
    expect(replayRollingScores([kept, reported])).toEqual(replayRollingScores([kept]));
  });
});
