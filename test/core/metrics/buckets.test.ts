import { describe, it, expect, vi } from 'vitest';

// Metrics.ts imports `vscode` for the client class; the bucketing helpers don't need it.
vi.mock('vscode', () => ({}));

const { scoreBucket, secondsBucket } = await import('../../../src/core/metrics/Metrics');

describe('metric buckets', () => {
  it('rounds scores down to a tenth, so no exact score is ever sent', () => {
    expect(scoreBucket(0)).toBe(0);
    expect(scoreBucket(0.47)).toBe(40);
    expect(scoreBucket(1)).toBe(100);
  });

  it('coarsens answer time into a handful of buckets', () => {
    expect(secondsBucket(4_000)).toBe(15);
    expect(secondsBucket(45_000)).toBe(60);
    expect(secondsBucket(10 * 60_000)).toBe(999);
  });
});
