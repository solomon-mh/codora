import { describe, it, expect } from 'vitest';
import { DeterministicEvaluator, isShallowFreeTextAnswer } from '../../../src/core/scoring/Evaluator';
import type { ChallengeAnswer, GeneratedQuestion } from '../../../src/core/questions/QuestionTypes';

const evaluator = new DeterministicEvaluator();

function mcQuestion(): GeneratedQuestion {
  return {
    id: 'q1',
    type: 'recall',
    category: 'recall',
    difficulty: 'easy',
    prompt: 'What does foo() return?',
    body: {
      kind: 'multiple-choice',
      options: [
        { id: 'a', text: 'the total' },
        { id: 'b', text: 'undefined' },
      ],
      correctOptionId: 'a',
    },
    provenance: { sourceFiles: ['foo.ts'], sourceType: 'git-diff', reason: 'x' },
    isRetentionCheck: false,
    createdAt: 0,
  };
}

function freeTextQuestion(): GeneratedQuestion {
  return {
    id: 'q2',
    type: 'cause',
    category: 'reasoning',
    difficulty: 'medium',
    prompt: 'Why did you make this change?',
    body: { kind: 'free-text', rubricKeywords: ['validation', 'token'], maxLength: 500 },
    provenance: { sourceFiles: ['auth.ts'], sourceType: 'git-diff', reason: 'x' },
    isRetentionCheck: false,
    createdAt: 0,
  };
}

describe('DeterministicEvaluator - multiple choice', () => {
  it('scores the correct option as fully correct', () => {
    const answer: ChallengeAnswer = { questionId: 'q1', kind: 'multiple-choice', selectedOptionId: 'a', answeredAt: 0, timeTakenMs: 0 };
    const result = evaluator.evaluate(mcQuestion(), answer);
    expect(result.correct).toBe(true);
    expect(result.score).toBe(1);
  });

  it('scores a wrong option as incorrect and reveals the right answer', () => {
    const answer: ChallengeAnswer = { questionId: 'q1', kind: 'multiple-choice', selectedOptionId: 'b', answeredAt: 0, timeTakenMs: 0 };
    const result = evaluator.evaluate(mcQuestion(), answer);
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
    expect(result.gaps[0]).toContain('the total');
  });
});

describe('DeterministicEvaluator - free text', () => {
  it('gives high score when the answer covers the rubric keywords with enough detail', () => {
    const answer: ChallengeAnswer = {
      questionId: 'q2',
      kind: 'free-text',
      text: 'I added validation to reject an expired token before it reaches the handler.',
      answeredAt: 0,
      timeTakenMs: 0,
    };
    const result = evaluator.evaluate(freeTextQuestion(), answer);
    expect(result.correct).toBe(true);
    expect(result.score).toBeGreaterThan(0.5);
  });

  it('gives a low score for an empty or trivial answer', () => {
    const answer: ChallengeAnswer = { questionId: 'q2', kind: 'free-text', text: 'idk', answeredAt: 0, timeTakenMs: 0 };
    const result = evaluator.evaluate(freeTextQuestion(), answer);
    expect(result.correct).toBe(false);
  });
});

describe('isShallowFreeTextAnswer', () => {
  it('flags very short answers as shallow', () => {
    const answer: ChallengeAnswer = { questionId: 'q2', kind: 'free-text', text: 'it validates', answeredAt: 0, timeTakenMs: 0 };
    expect(isShallowFreeTextAnswer(freeTextQuestion(), answer)).toBe(true);
  });

  it('does not flag a substantive answer touching the rubric', () => {
    const answer: ChallengeAnswer = {
      questionId: 'q2',
      kind: 'free-text',
      text: 'This adds token validation so an expired session cannot reach protected routes.',
      answeredAt: 0,
      timeTakenMs: 0,
    };
    expect(isShallowFreeTextAnswer(freeTextQuestion(), answer)).toBe(false);
  });

  it('is not applicable to multiple-choice questions', () => {
    const answer: ChallengeAnswer = { questionId: 'q1', kind: 'multiple-choice', selectedOptionId: 'a', answeredAt: 0, timeTakenMs: 0 };
    expect(isShallowFreeTextAnswer(mcQuestion(), answer)).toBe(false);
  });
});
