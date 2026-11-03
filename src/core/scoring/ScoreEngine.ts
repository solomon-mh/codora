import {
  CATEGORY_WEIGHTS,
  SCORE_CATEGORIES,
  createDefaultRollingScores,
  type RollingScore,
  type RollingScoreMap,
  type ScoreCategory,
} from './ScoreTypes';
import { QUESTION_TYPE_TO_SCORE_CATEGORY, type ChallengeRecord } from '../questions/QuestionTypes';

/**
 * How strongly a new result shifts the rolling score. Higher = more
 * responsive to recent performance, lower = more stable (spec section 23:
 * "recent performance should matter more" without letting one answer swing
 * everything).
 */
const RECENCY_ALPHA = 0.25;

/**
 * Where every category starts before its first answer. Starting neutral
 * rather than at the first result means one answer can't pin a category
 * to 0 or 100, and — because the score only ever approaches 0 — every
 * wrong answer still lowers it (50 → 37.5 → 28.1 → 21.1 …). Starting at the
 * first result instead left a category at exactly 0 after a wrong first
 * answer, where further wrong answers changed nothing.
 */
export const NEUTRAL_START = 50;

/** Recompute one category's rolling score given a new 0-1 result. */
export function updateRollingScore(
  scores: RollingScoreMap,
  category: ScoreCategory,
  result0to1: number,
  now: number,
): RollingScoreMap {
  const current = scores[category];
  const resultAsScore = result0to1 * 100;
  const previous = current.sampleCount === 0 ? NEUTRAL_START : current.value;
  const value = previous * (1 - RECENCY_ALPHA) + resultAsScore * RECENCY_ALPHA;

  return {
    ...scores,
    [category]: {
      value: clamp(value, 0, 100),
      sampleCount: current.sampleCount + 1,
      lastUpdated: now,
    },
  };
}

/**
 * Rebuild rolling scores from answered challenges, oldest first. Used to
 * migrate project scores exactly when the scoring rule changes.
 */
export function replayRollingScores(records: ChallengeRecord[]): RollingScoreMap {
  return [...records]
    .sort((a, b) => a.answer.answeredAt - b.answer.answeredAt)
    .reduce(
      (scores, r) =>
        updateRollingScore(scores, QUESTION_TYPE_TO_SCORE_CATEGORY[r.question.type], r.evaluation.score, r.answer.answeredAt),
      createDefaultRollingScores(),
    );
}

/**
 * Move a score kept under the old rule (seeded with its first result) onto
 * the neutral start, when the individual answers aren't stored. The two
 * rules differ only by the seed, decayed over every later answer:
 * new = old + (1 - α)^n · (NEUTRAL_START − first result). The first result
 * isn't kept, so it's taken to equal the current value — exact when a
 * category's answers were all right or all wrong, close otherwise.
 */
export function rebaseOnNeutralStart(score: RollingScore): RollingScore {
  if (score.sampleCount === 0) return score;
  const decay = Math.pow(1 - RECENCY_ALPHA, score.sampleCount);
  return { ...score, value: clamp(score.value + decay * (NEUTRAL_START - score.value), 0, 100) };
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
