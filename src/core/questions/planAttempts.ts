export interface PlannedAttempt {
  categoryIndex: number;
  /** How many times this category has come round — used to vary the question type. */
  round: number;
  candidateIndex: number;
}

/**
 * Orders the (category, question type, file) combinations a provider
 * should try, most promising first.
 *
 * The attempt budget is small (MAX_AI_ATTEMPTS_PER_PROVIDER), so what
 * those few attempts vary decides whether a challenge gets generated at
 * all. This used to be three nested loops with the file list innermost,
 * which spent the entire budget on one category and one question type,
 * changing only the file. That is the least useful dimension to vary: a
 * model declining is it saying "this *kind* of question doesn't fit this
 * code", and the answer to that is a different kind of question, not the
 * same one about the next file. A run that happened to draw "security"
 * first would ask three files for a security question, get three declines,
 * and report the provider as failing.
 *
 * So the traversal is diagonal instead: the first pass takes one attempt
 * per category, each against a different file, so a small budget covers
 * several kinds of question rather than several files.
 *
 * `offset` shifts which file each category starts on. Providers are tried
 * in sequence against an identical candidate list, so without it every
 * provider would repeat the exact combinations the previous one just
 * failed — which is what turned one unsuitable pairing into a wall of
 * identical per-provider failures.
 */
export function planAttempts(
  categoryCount: number,
  candidateCount: number,
  offset: number,
): PlannedAttempt[] {
  if (categoryCount === 0 || candidateCount === 0) return [];

  const plan: PlannedAttempt[] = [];
  for (let round = 0; round < candidateCount; round++) {
    for (let categoryIndex = 0; categoryIndex < categoryCount; categoryIndex++) {
      plan.push({
        categoryIndex,
        round,
        candidateIndex: (categoryIndex + round + offset) % candidateCount,
      });
    }
  }
  return plan;
}
