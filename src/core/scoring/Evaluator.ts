import type { ChallengeAnswer, GeneratedQuestion } from '../questions/QuestionTypes';
import type { EvaluationResult } from './ScoreTypes';

/**
 * Answer evaluation contract (spec section 17's JSON shape). This pass
 * ships exactly one implementation, DeterministicEvaluator — nothing else
 * depends on evaluation being deterministic, so a future LLM-backed
 * evaluator can implement this interface without touching any caller.
 */
export interface Evaluator {
  evaluate(question: GeneratedQuestion, answer: ChallengeAnswer): EvaluationResult;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Deterministic evaluator: exact match for multiple-choice, keyword/rubric
 * overlap for free-text. Free-text scoring is a heuristic, not true
 * language understanding — it is intentionally generous (partial credit)
 * rather than punitive, per spec section 19's "don't shame users" rule.
 */
export class DeterministicEvaluator implements Evaluator {
  evaluate(question: GeneratedQuestion, answer: ChallengeAnswer): EvaluationResult {
    if (question.body.kind === 'multiple-choice') {
      return this.evaluateMultipleChoice(question, answer);
    }
    return this.evaluateFreeText(question, answer);
  }

  private evaluateMultipleChoice(
    question: GeneratedQuestion,
    answer: ChallengeAnswer,
  ): EvaluationResult {
    const body = question.body;
    if (body.kind !== 'multiple-choice') throw new Error('mismatched question body');
    const correct = answer.selectedOptionId === body.correctOptionId;
    const correctOption = body.options.find((o) => o.id === body.correctOptionId);
    return {
      score: correct ? 1 : 0,
      correct,
      confidence: 1,
      strengths: correct ? ['Selected the correct option'] : [],
      gaps: correct ? [] : [`The correct answer was: ${correctOption?.text ?? 'unknown'}`],
      feedback: correct
        ? 'Correct.'
        : `Not quite. ${correctOption ? `The right answer: ${correctOption.text}` : ''}`,
    };
  }

  private evaluateFreeText(question: GeneratedQuestion, answer: ChallengeAnswer): EvaluationResult {
    const body = question.body;
    if (body.kind !== 'free-text') throw new Error('mismatched question body');
    const text = answer.text ?? '';
    const words = new Set(normalizeWords(text));
    const matched = body.rubricKeywords.filter((k) =>
      normalizeWords(k).every((kw) => words.has(kw)),
    );
    const coverage = body.rubricKeywords.length > 0 ? matched.length / body.rubricKeywords.length : 0;
    const lengthSignal = Math.min(text.trim().length / 40, 1);
    const score = Math.min(1, coverage * 0.75 + lengthSignal * 0.25);
    const correct = score >= 0.5;
    const missed = body.rubricKeywords.filter((k) => !matched.includes(k));

    return {
      score,
      correct,
      confidence: 0.6,
      strengths: matched.length > 0 ? [`Touched on: ${matched.join(', ')}`] : [],
      gaps: missed.length > 0 ? [`Consider also: ${missed.join(', ')}`] : [],
      feedback:
        score >= 0.75
          ? 'Solid explanation.'
          : score >= 0.5
            ? 'Good start — a bit more detail would make this stronger.'
            : 'This could go deeper — see what you may have missed below.',
    };
  }
}

/** Heuristic for "shallow answer" that should trigger a follow-up (spec section 20). */
export function isShallowFreeTextAnswer(question: GeneratedQuestion, answer: ChallengeAnswer): boolean {
  if (question.body.kind !== 'free-text') return false;
  const text = (answer.text ?? '').trim();
  if (text.length < 15) return true;
  const words = new Set(normalizeWords(text));
  const anyRubricHit = question.body.rubricKeywords.some((k) =>
    normalizeWords(k).some((kw) => words.has(kw)),
  );
  return !anyRubricHit;
}
