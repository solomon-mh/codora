import { describe, it, expect } from 'vitest';
import { validateGenerationPayload } from '../../../src/core/ai/parseAIResponse';

const validQuestion = {
  prompt: 'What does this function return when the list is empty?',
  kind: 'multiple-choice',
  options: [{ id: 'a', text: 'undefined' }, { id: 'b', text: 'zero' }],
  correctOptionId: 'a',
};

describe('validateGenerationPayload', () => {
  it('reports the prompt-defined skip signal as a decline, not as bad output', () => {
    // The generation prompt tells the model to answer {"skip": true} when
    // the snippet does not support the question type. Treating that as
    // malformed told users a well-behaved model had misformatted its reply.
    expect(validateGenerationPayload({ skip: true })).toEqual({ outcome: 'declined' });
  });

  it('does not treat an explicit non-skip as a decline', () => {
    expect(validateGenerationPayload({ ...validQuestion, skip: false })).toEqual({
      outcome: 'question',
      payload: expect.objectContaining({ prompt: validQuestion.prompt }),
    });
  });

  it('reports genuinely malformed output as unusable', () => {
    expect(validateGenerationPayload({ prompt: 'hi' })).toEqual({ outcome: 'unusable' });
    expect(validateGenerationPayload(undefined)).toEqual({ outcome: 'unusable' });
    expect(validateGenerationPayload('not an object')).toEqual({ outcome: 'unusable' });
  });

  it('accepts a well-formed multiple-choice question', () => {
    const result = validateGenerationPayload(validQuestion);
    expect(result.outcome).toBe('question');
  });

  it('rejects a multiple-choice question whose correct id matches no option', () => {
    expect(validateGenerationPayload({ ...validQuestion, correctOptionId: 'z' })).toEqual({
      outcome: 'unusable',
    });
  });

  it('accepts a free-text question with rubric keywords', () => {
    const result = validateGenerationPayload({
      prompt: 'Explain why the retry loop sleeps after the final attempt.',
      kind: 'free-text',
      rubricKeywords: ['backoff', 'final attempt', 'wasted delay'],
    });
    expect(result.outcome).toBe('question');
  });

  it('rejects a free-text question with no rubric keywords', () => {
    expect(
      validateGenerationPayload({ prompt: 'Explain this.', kind: 'free-text', rubricKeywords: [] }),
    ).toEqual({ outcome: 'unusable' });
  });
});
