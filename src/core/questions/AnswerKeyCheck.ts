import type { AIProvider } from '../ai/AITypes';
import type { GeneratedQuestion } from './QuestionTypes';
import { getLogger } from '../../utils/logger';

/**
 * What the blind check found:
 * - 'confirmed': answering without the key, the checker picked the keyed option.
 * - 'disagreed': it picked a different option — the key may be wrong.
 * - 'ambiguous': it found no option, or several, defensibly correct.
 * - 'unchecked': the check couldn't run (error, unusable reply, free text).
 */
export type AnswerKeyVerdict = 'confirmed' | 'disagreed' | 'ambiguous' | 'unchecked';

/**
 * Re-asks a generated multiple-choice question to a model without its
 * answer key. A model-written key can simply be wrong, and a wrong key
 * marks a correct answer as wrong — so a question whose key doesn't
 * survive a blind answer is never shown. Options are shuffled first so a
 * model's bias toward the first (or keyed) position can't confirm the key.
 *
 * Failing to run the check is not failing the check: a provider hiccup
 * shouldn't cost the developer a question, so that case shows it as
 * 'unchecked'.
 */
export async function checkAnswerKey(
  question: GeneratedQuestion,
  checker: AIProvider,
  shuffle: <T>(items: T[]) => T[] = shuffled,
): Promise<AnswerKeyVerdict> {
  const body = question.body;
  const snippet = question.provenance.codeSnippet;
  if (body.kind !== 'multiple-choice' || !snippet) return 'unchecked';

  try {
    const check = await checker.checkAnswerKey({
      questionPrompt: question.prompt,
      codeSnippet: snippet,
      options: shuffle(body.options),
    });
    if (!check) return 'unchecked';
    if (check.ambiguous) return 'ambiguous';
    return check.optionId === body.correctOptionId ? 'confirmed' : 'disagreed';
  } catch (err) {
    getLogger().warn('Answer-key check could not run; showing the question unchecked', {
      checker: checker.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return 'unchecked';
  }
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
