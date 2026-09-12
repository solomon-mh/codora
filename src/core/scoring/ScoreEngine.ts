import {
  CATEGORY_WEIGHTS,
  SCORE_CATEGORIES,
  type RollingScoreMap,
  type ScoreCategory,
} from './ScoreTypes';

/**
 * How strongly a new result shifts the rolling score. Higher = more
 * responsive to recent performance, lower = more stable (spec section 23:
 * "recent performance should matter more" without letting one answer swing
 * everything).
 */
const RECENCY_ALPHA = 0.25;

/** Recompute one category's rolling score given a new 0-1 result. */
export function updateRollingScore(
  scores: RollingScoreMap,
  category: ScoreCategory,
  result0to1: number,
  now: number,
): RollingScoreMap {
  const current = scores[category];
  const resultAsScore = result0to1 * 100;

  const value =
    current.sampleCount === 0
      ? resultAsScore
      : current.value * (1 - RECENCY_ALPHA) + resultAsScore * RECENCY_ALPHA;

  return {
    ...scores,
    [category]: {
      value: clamp(value, 0, 100),
      sampleCount: current.sampleCount + 1,
      lastUpdated: now,
    },
  };
}

/** Weighted Aura composite across all 8 categories, 0-100 (spec section 21-22). */
export function computeAura(scores: RollingScoreMap): number {
  let weightedSum = 0;
  let weightUsed = 0;

  for (const category of SCORE_CATEGORIES) {
    const score = scores[category];
    if (score.sampleCount === 0) continue;
    const weight = CATEGORY_WEIGHTS[category];
    weightedSum += score.value * weight;
    weightUsed += weight;
  }

  if (weightUsed === 0) return 0;
  // Renormalize over categories that actually have data, so a brand-new
  // user isn't penalized for categories they haven't been asked about yet.
  return clamp(weightedSum / weightUsed, 0, 100);
}

export type AuraLabel =
  | 'Exceptional'
  | 'Excellent'
  | 'Strong'
  | 'Developing'
  | 'Needs attention'
  | 'Beginning';

export function auraLabel(aura: number): AuraLabel {
  if (aura >= 90) return 'Exceptional';
  if (aura >= 80) return 'Excellent';
  if (aura >= 70) return 'Strong';
  if (aura >= 60) return 'Developing';
  if (aura >= 40) return 'Needs attention';
  return 'Beginning';
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
