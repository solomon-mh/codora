import type { Difficulty } from './QuestionTypes';
import type { RollingScoreMap, ScoreCategory } from '../scoring/ScoreTypes';

const ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert'];

/**
 * Simple, real (not fake) adaptive difficulty (spec section 13/31): new
 * users start easy/medium, and difficulty for a category shifts with that
 * category's rolling accuracy. This is a deliberate first pass, not the
 * eventual learned/tuned version.
 */
export function pickDifficulty(
  category: ScoreCategory,
  rollingScores: RollingScoreMap,
): Difficulty {
  const score = rollingScores[category];

  if (!score || score.sampleCount < 3) {
    return 'easy';
  }

  if (score.value >= 90) return 'expert';
  if (score.value >= 75) return 'hard';
  if (score.value >= 55) return 'medium';
  return 'easy';
}

export function difficultyIndex(d: Difficulty): number {
  return ORDER.indexOf(d);
}
