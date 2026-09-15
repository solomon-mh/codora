import { describe, it, expect } from 'vitest';
import { planAttempts } from '../../../src/core/questions/planAttempts';

describe('planAttempts', () => {
  it('varies the category on every one of the first attempts', () => {
    // The whole point of the diagonal order: a small attempt budget must
    // buy coverage of several question kinds, not several files asked the
    // same unsuitable question.
    const plan = planAttempts(7, 8, 0).slice(0, 3);
    expect(plan.map((s) => s.categoryIndex)).toEqual([0, 1, 2]);
  });

  it('varies the file on every one of the first attempts too', () => {
    const plan = planAttempts(7, 8, 0).slice(0, 3);
    expect(new Set(plan.map((s) => s.candidateIndex)).size).toBe(3);
  });

  it('gives each provider a different starting combination', () => {
    // Providers run in sequence over an identical candidate list, so
    // without an offset provider 2 replays exactly what provider 1 failed.
    const first = planAttempts(7, 8, 0).slice(0, 3);
    const second = planAttempts(7, 8, 1).slice(0, 3);
    expect(second.map((s) => s.candidateIndex)).not.toEqual(first.map((s) => s.candidateIndex));
  });

  it('advances the question type as a category comes round again', () => {
    const plan = planAttempts(2, 4, 0);
    const forCategoryZero = plan.filter((s) => s.categoryIndex === 0);
    expect(forCategoryZero.map((s) => s.round)).toEqual([0, 1, 2, 3]);
  });

  it('covers every file for every category', () => {
    expect(planAttempts(3, 5, 0)).toHaveLength(15);
  });

  it('stays in range for any offset', () => {
    for (const step of planAttempts(7, 3, 11)) {
      expect(step.candidateIndex).toBeGreaterThanOrEqual(0);
      expect(step.candidateIndex).toBeLessThan(3);
    }
  });

  it('returns nothing when there is nothing to try', () => {
    expect(planAttempts(0, 5, 0)).toEqual([]);
    expect(planAttempts(5, 0, 0)).toEqual([]);
  });
});
