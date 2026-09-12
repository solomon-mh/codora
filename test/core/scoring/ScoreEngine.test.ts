import { describe, it, expect } from 'vitest';
import { updateRollingScore, computeAura, auraLabel } from '../../../src/core/scoring/ScoreEngine';
import { createDefaultRollingScores } from '../../../src/core/scoring/ScoreTypes';

describe('updateRollingScore', () => {
  it('sets the first sample directly to the result value', () => {
    const scores = createDefaultRollingScores();
    const next = updateRollingScore(scores, 'recall', 1, 1000);
    expect(next.recall.value).toBe(100);
    expect(next.recall.sampleCount).toBe(1);
  });

  it('weights recent results more heavily than the running average', () => {
    let scores = createDefaultRollingScores();
    scores = updateRollingScore(scores, 'recall', 1, 1000); // 100
    scores = updateRollingScore(scores, 'recall', 1, 2000); // still 100
    scores = updateRollingScore(scores, 'recall', 0, 3000); // drags down
    expect(scores.recall.value).toBeLessThan(100);
    expect(scores.recall.value).toBeGreaterThan(0);
    expect(scores.recall.sampleCount).toBe(3);
  });

  it('clamps to the 0-100 range', () => {
    let scores = createDefaultRollingScores();
    scores = updateRollingScore(scores, 'debugging', 1, 1000);
    scores = updateRollingScore(scores, 'debugging', 1, 2000);
    expect(scores.debugging.value).toBeLessThanOrEqual(100);
    expect(scores.debugging.value).toBeGreaterThanOrEqual(0);
  });

  it('leaves other categories untouched', () => {
    const scores = createDefaultRollingScores();
    const next = updateRollingScore(scores, 'recall', 1, 1000);
    expect(next.reasoning.sampleCount).toBe(0);
  });
});

describe('computeAura', () => {
  it('returns 0 when there is no data at all', () => {
    expect(computeAura(createDefaultRollingScores())).toBe(0);
  });

  it('renormalizes over only the categories with data', () => {
    let scores = createDefaultRollingScores();
    scores = updateRollingScore(scores, 'recall', 1, 1000); // recall = 100
    // Only recall has data — Aura should equal 100, not be diluted by
    // the 7 other untouched categories.
    expect(computeAura(scores)).toBe(100);
  });

  it('produces a value between 0 and 100 for mixed scores', () => {
    let scores = createDefaultRollingScores();
    scores = updateRollingScore(scores, 'recall', 1, 1000);
    scores = updateRollingScore(scores, 'debugging', 0, 1000);
    const aura = computeAura(scores);
    expect(aura).toBeGreaterThan(0);
    expect(aura).toBeLessThan(100);
  });
});

describe('auraLabel', () => {
  it.each([
    [95, 'Exceptional'],
    [85, 'Excellent'],
    [75, 'Strong'],
    [65, 'Developing'],
    [50, 'Needs attention'],
    [10, 'Beginning'],
  ] as const)('labels %i as %s', (value, expected) => {
    expect(auraLabel(value)).toBe(expected);
  });
});
