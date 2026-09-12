/**
 * The 8 comprehension dimensions Codora tracks (spec section 21).
 * `retention` has no dedicated question type — it is derived from accuracy
 * on questions that re-probe something asked about previously (see
 * ScoreEngine.isRetentionCheck).
 */
export type ScoreCategory =
  | 'recall'
  | 'reasoning'
  | 'debugging'
  | 'architecture'
  | 'testing'
  | 'security'
  | 'performance'
  | 'retention';

export const SCORE_CATEGORIES: ScoreCategory[] = [
  'recall',
  'reasoning',
  'debugging',
  'architecture',
  'testing',
  'security',
  'performance',
  'retention',
];

/**
 * Internal weighting for the Aura composite (spec section 21). Deliberately
 * not exposed to users/UI beyond the resulting Aura number and per-category
 * breakdown.
 */
export const CATEGORY_WEIGHTS: Record<ScoreCategory, number> = {
  recall: 0.15,
  reasoning: 0.2,
  debugging: 0.2,
  architecture: 0.15,
  testing: 0.1,
  security: 0.05,
  performance: 0.05,
  retention: 0.1,
};

/** A single category's rolling comprehension score. */
export interface RollingScore {
  /** Exponentially recency-weighted score, 0-100. */
  value: number;
  /** Total challenges that have contributed to this rolling score. */
  sampleCount: number;
  lastUpdated: number;
}

export type RollingScoreMap = Record<ScoreCategory, RollingScore>;

export function createDefaultRollingScores(): RollingScoreMap {
  const map = {} as RollingScoreMap;
  for (const category of SCORE_CATEGORIES) {
    map[category] = { value: 0, sampleCount: 0, lastUpdated: 0 };
  }
  return map;
}

export interface EvaluationResult {
  /** 0-1 normalized correctness. */
  score: number;
  correct: boolean;
  confidence: number;
  strengths: string[];
  gaps: string[];
  feedback: string;
}
