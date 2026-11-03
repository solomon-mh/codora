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

/** Aura tiers, lowest first. The webview's tier scale draws from this same table. */
export const AURA_TIERS: readonly { min: number; label: AuraLabel }[] = [
  { min: 0, label: 'Beginning' },
  { min: 40, label: 'Needs attention' },
  { min: 60, label: 'Developing' },
  { min: 70, label: 'Strong' },
  { min: 80, label: 'Excellent' },
  { min: 90, label: 'Exceptional' },
];

export function auraLabel(aura: number): AuraLabel {
  for (let i = AURA_TIERS.length - 1; i > 0; i--) {
    if (aura >= AURA_TIERS[i].min) return AURA_TIERS[i].label;
  }
  return AURA_TIERS[0].label;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
