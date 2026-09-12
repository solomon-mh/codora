import { describe, it, expect } from 'vitest';
import { generateRecall } from '../../../src/core/questions/templates/recall';
import { generatePrediction } from '../../../src/core/questions/templates/prediction';
import { generateArchitecture } from '../../../src/core/questions/templates/architecture';
import { extractFunctions } from '../../../src/core/context/CodeContextExtractor';
import type { TemplateContext } from '../../../src/core/questions/QuestionGenerator';

function baseCtx(overrides: Partial<TemplateContext>): TemplateContext {
  return {
    file: { relativePath: 'src/cart.ts', text: '' },
    commitMessage: null,
    now: Date.now(),
    isRetentionCheck: false,
    ...overrides,
  };
}

describe('generateRecall', () => {
  it('skips when there is no function context', () => {
    expect(generateRecall(baseCtx({}))).toBeUndefined();
  });

  it('skips when the function has no return statement', () => {
    const fns = extractFunctions('function log() { console.log("hi"); }', 'src/cart.ts');
    expect(generateRecall(baseCtx({ fn: fns[0] }))).toBeUndefined();
  });

  it('builds a defensible multiple-choice question from a real return statement', () => {
    const fns = extractFunctions('function total(items) { return items.length; }', 'src/cart.ts');
    const q = generateRecall(baseCtx({ fn: fns[0] }));
    expect(q).toBeDefined();
    const body = q!.body;
    expect(body.kind).toBe('multiple-choice');
    if (body.kind === 'multiple-choice') {
      const correct = body.options.find((o) => o.id === body.correctOptionId);
      expect(correct?.text).toContain('items.length');
    }
  });
});

describe('generatePrediction', () => {
  it('skips when there is no guard clause', () => {
    const fns = extractFunctions('function total(items) { return items.length; }', 'src/cart.ts');
    expect(generatePrediction(baseCtx({ fn: fns[0] }))).toBeUndefined();
  });

  it('builds a question from a real guard clause', () => {
    const fns = extractFunctions('function getUser(userId) { if (!userId) return null; return db.find(userId); }', 'src/users.ts');
    const q = generatePrediction(baseCtx({ file: { relativePath: 'src/users.ts', text: '' }, fn: fns[0] }));
    expect(q).toBeDefined();
    expect(q!.category).toBe('reasoning');
  });
});

describe('generateArchitecture', () => {
  it('skips for a path with no recognizable role', () => {
    expect(generateArchitecture(baseCtx({ file: { relativePath: 'src/index.ts', text: '' } }))).toBeUndefined();
  });

  it('builds a question keyed off the directory role', () => {
    const q = generateArchitecture(baseCtx({ file: { relativePath: 'src/services/payment.ts', text: '' } }));
    expect(q).toBeDefined();
    expect(q!.category).toBe('architecture');
  });
});
