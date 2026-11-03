import { describe, it, expect } from 'vitest';
import { updateRollingScore, computeAura, auraLabel } from '../../../src/core/scoring/ScoreEngine';
import { createDefaultRollingScores } from '../../../src/core/scoring/ScoreTypes';

describe('updateRollingScore', () => {
  it('starts each category from a neutral 50, not the first result', () => {
    const scores = createDefaultRollingScores();
    expect(updateRollingScore(scores, 'recall', 1, 1000).recall.value).toBe(62.5);
    expect(updateRollingScore(scores, 'recall', 0, 1000).recall.value).toBe(37.5);
    expect(updateRollingScore(scores, 'recall', 1, 1000).recall.sampleCount).toBe(1);
  });

  it('lowers the score on every wrong answer, however low it already is', () => {
    let scores = createDefaultRollingScores();
    let previous = Infinity;
    for (let i = 0; i < 20; i++) {
      scores = updateRollingScore(scores, 'debugging', 0, 1000 + i);
      expect(scores.debugging.value).toBeLessThan(previous);
      previous = scores.debugging.value;
    }
  });

  it('lowers the aura when a wrong answer lands in an already-weak category', () => {
    let scores = createDefaultRollingScores();
    scores = updateRollingScore(scores, 'recall', 1, 1000);
    scores = updateRollingScore(scores, 'debugging', 0, 1000);
    scores = updateRollingScore(scores, 'debugging', 0, 2000);
    const before = computeAura(scores);
    scores = updateRollingScore(scores, 'debugging', 0, 3000);
    expect(computeAura(scores)).toBeLessThan(before);
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
    scores = updateRollingScore(scores, 'recall', 1, 1000); // recall = 62.5
    // Only recall has data — Aura should equal recall's score, not be
    // diluted by the 7 other untouched categories.
    expect(computeAura(scores)).toBe(scores.recall.value);
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
