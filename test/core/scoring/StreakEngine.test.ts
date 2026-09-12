import { describe, it, expect } from 'vitest';
import { recordChallengeCompletion, applyStreakDecay } from '../../../src/core/scoring/StreakEngine';
import type { StreakState } from '../../../src/core/storage/StorageSchema';

const DAY = 24 * 60 * 60 * 1000;
const day0 = new Date('2026-01-01T12:00:00Z').getTime();

function emptyStreak(): StreakState {
  return { current: 0, longest: 0, lastActiveDate: null, daysActive: 0 };
}

describe('recordChallengeCompletion', () => {
  it('starts a streak at 1 on the first completion', () => {
    const next = recordChallengeCompletion(emptyStreak(), day0);
    expect(next.current).toBe(1);
    expect(next.longest).toBe(1);
  });

  it('increments on a consecutive day', () => {
    let streak = recordChallengeCompletion(emptyStreak(), day0);
    streak = recordChallengeCompletion(streak, day0 + DAY);
    expect(streak.current).toBe(2);
    expect(streak.longest).toBe(2);
  });

  it('does not double-count multiple completions on the same day', () => {
    let streak = recordChallengeCompletion(emptyStreak(), day0);
    streak = recordChallengeCompletion(streak, day0 + 1000);
    expect(streak.current).toBe(1);
    expect(streak.daysActive).toBe(1);
  });

  it('resets to 1 after a missed day', () => {
    let streak = recordChallengeCompletion(emptyStreak(), day0);
    streak = recordChallengeCompletion(streak, day0 + DAY);
    streak = recordChallengeCompletion(streak, day0 + 3 * DAY); // skipped a day
    expect(streak.current).toBe(1);
    expect(streak.longest).toBe(2);
  });
});

describe('applyStreakDecay', () => {
  it('zeroes the current streak once more than a day has passed with no activity', () => {
    let streak = recordChallengeCompletion(emptyStreak(), day0);
    streak = applyStreakDecay(streak, day0 + 3 * DAY);
    expect(streak.current).toBe(0);
  });

  it('does not decay a streak still within its active day or the next', () => {
    const streak = recordChallengeCompletion(emptyStreak(), day0);
    const decayed = applyStreakDecay(streak, day0 + DAY);
    expect(decayed.current).toBe(1);
  });
});
