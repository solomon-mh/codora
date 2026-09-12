import { describe, it, expect } from 'vitest';
import { questionFingerprint } from '../../../src/core/questions/questionFingerprint';

describe('questionFingerprint', () => {
  it('is identical for the same type/file/function', () => {
    const a = questionFingerprint('recall', 'src/cart.ts', 'total');
    const b = questionFingerprint('recall', 'src/cart.ts', 'total');
    expect(a).toBe(b);
  });

  it('differs when the type changes', () => {
    const a = questionFingerprint('recall', 'src/cart.ts', 'total');
    const b = questionFingerprint('debugging', 'src/cart.ts', 'total');
    expect(a).not.toBe(b);
  });

  it('differs when the file changes', () => {
    const a = questionFingerprint('recall', 'src/cart.ts', 'total');
    const b = questionFingerprint('recall', 'src/other.ts', 'total');
    expect(a).not.toBe(b);
  });

  it('differs when the subject function changes, including no function at all', () => {
    const withFn = questionFingerprint('architecture', 'src/services/pay.ts', 'charge');
    const withoutFn = questionFingerprint('architecture', 'src/services/pay.ts');
    expect(withFn).not.toBe(withoutFn);
  });
});
