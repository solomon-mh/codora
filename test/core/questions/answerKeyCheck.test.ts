import { describe, it, expect } from 'vitest';
import { checkAnswerKey } from '../../../src/core/questions/AnswerKeyCheck';
import type { AIAnswerCheck, AIProvider } from '../../../src/core/ai/AITypes';
import type { GeneratedQuestion } from '../../../src/core/questions/QuestionTypes';
import { initLogger } from '../../../src/utils/logger';

initLogger({ appendLine: () => {} });

const question = {
  id: 'q1',
  prompt: 'What does it return?',
  body: {
    kind: 'multiple-choice',
    correctOptionId: 'b',
    options: [
      { id: 'a', text: 'null' },
      { id: 'b', text: 'the cached value' },
      { id: 'c', text: 'a new object' },
    ],
  },
  provenance: { sourceFiles: ['src/a.ts'], sourceType: 'git-diff', reason: 'changed', codeSnippet: 'return cache;' },
} as unknown as GeneratedQuestion;

function checker(answer: AIAnswerCheck | undefined | Error): AIProvider {
  return {
    id: 'anthropic',
    checkAnswerKey: async () => {
      if (answer instanceof Error) throw answer;
      return answer;
    },
  } as unknown as AIProvider;
}

const keepOrder = <T,>(items: T[]) => items;

describe('checkAnswerKey', () => {
  it('confirms a key the blind answer agrees with', async () => {
    expect(await checkAnswerKey(question, checker({ optionId: 'b', ambiguous: false }), keepOrder)).toBe('confirmed');
  });

  it('rejects a key the blind answer disagrees with', async () => {
    expect(await checkAnswerKey(question, checker({ optionId: 'a', ambiguous: false }), keepOrder)).toBe('disagreed');
  });

  it('rejects a question the checker finds ambiguous', async () => {
    expect(await checkAnswerKey(question, checker({ optionId: null, ambiguous: true }), keepOrder)).toBe('ambiguous');
  });

  it("doesn't cost the developer a question when the check can't run", async () => {
    expect(await checkAnswerKey(question, checker(undefined), keepOrder)).toBe('unchecked');
    expect(await checkAnswerKey(question, checker(new Error('rate limited')), keepOrder)).toBe('unchecked');
  });

  it('never sends the answer key, and shuffles the options it does send', async () => {
    let sent: unknown;
    const spy = {
      id: 'anthropic',
      checkAnswerKey: async (ctx: unknown) => {
        sent = ctx;
        return { optionId: 'b', ambiguous: false };
      },
    } as unknown as AIProvider;
    await checkAnswerKey(question, spy, (items) => [...items].reverse());
    expect(JSON.stringify(sent)).not.toContain('correctOptionId');
    expect((sent as { options: { id: string }[] }).options.map((o) => o.id)).toEqual(['c', 'b', 'a']);
  });

  it('leaves free-text questions unchecked', async () => {
    const freeText = { ...question, body: { kind: 'free-text', rubricKeywords: ['cache'], maxLength: 400 } } as GeneratedQuestion;
    expect(await checkAnswerKey(freeText, checker({ optionId: 'b', ambiguous: false }))).toBe('unchecked');
  });
});
