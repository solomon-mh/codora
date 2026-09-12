import { describe, it, expect } from 'vitest';
import {
  extractFunctions,
  extractReturnStatements,
  extractGuardClauses,
  findUnguardedPropertyAccess,
  hasNestedLoop,
  findValidationPatterns,
  extractTestDescriptions,
  detectDirectoryRole,
  parseChangedLines,
  findFunctionTouchedByLines,
} from '../../../src/core/context/CodeContextExtractor';

describe('extractFunctions (JS/TS)', () => {
  it('finds a named function declaration and its body', () => {
    const text = `function calculateTotal(items) {\n  return items.length;\n}`;
    const fns = extractFunctions(text, 'cart.ts');
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe('calculateTotal');
    expect(fns[0].params).toEqual(['items']);
  });

  it('finds an arrow function assigned to a const', () => {
    const text = `const total = (items) => {\n  return items.length;\n};`;
    const fns = extractFunctions(text, 'cart.ts');
    expect(fns.some((f) => f.name === 'total')).toBe(true);
  });

  it('returns nothing for an unsupported extension', () => {
    expect(extractFunctions('fn foo() {}', 'main.rs')).toEqual([]);
  });
});

describe('extractFunctions (Python)', () => {
  it('finds a def and captures its indented body', () => {
    const text = `def greet(name):\n    if not name:\n        return None\n    return f"hi {name}"\n\ndef other():\n    pass\n`;
    const fns = extractFunctions(text, 'app.py');
    expect(fns.map((f) => f.name)).toEqual(['greet', 'other']);
    expect(fns[0].params).toEqual(['name']);
  });
});

describe('extractReturnStatements', () => {
  it('collects unique return expressions', () => {
    const body = `if (x) { return 1; }\nreturn 2;\nreturn 1;`;
    expect(extractReturnStatements(body)).toEqual(['1', '2']);
  });

  it('returns an empty array when there are no returns', () => {
    expect(extractReturnStatements('doSomething();')).toEqual([]);
  });
});

describe('extractGuardClauses', () => {
  it('detects a negation guard that returns early', () => {
    const body = `if (!userId) return null;\nreturn fetchUser(userId);`;
    const guards = extractGuardClauses(body, ['userId']);
    expect(guards).toHaveLength(1);
    expect(guards[0].behavior).toBe('return');
  });

  it('detects a null-check guard that throws', () => {
    const body = `if (token === null) { throw new Error('missing token'); }`;
    const guards = extractGuardClauses(body, ['token']);
    expect(guards[0].behavior).toBe('throw');
  });

  it('finds nothing when there is no guard for the given params', () => {
    expect(extractGuardClauses('return a + b;', ['a', 'b'])).toEqual([]);
  });
});

describe('findUnguardedPropertyAccess', () => {
  it('flags a property access on a param with no guard', () => {
    const body = `return user.name;`;
    const findings = findUnguardedPropertyAccess(body, ['user'], new Set());
    expect(findings).toEqual([{ param: 'user', expression: 'user.name' }]);
  });

  it('does not flag a param that is already guarded', () => {
    const body = `if (!user) return null;\nreturn user.name;`;
    const findings = findUnguardedPropertyAccess(body, ['user'], new Set(['user']));
    expect(findings).toEqual([]);
  });
});

describe('hasNestedLoop', () => {
  it('detects a loop nested inside another loop', () => {
    const body = `for (let i = 0; i < a.length; i++) { for (let j = 0; j < b.length; j++) { check(a[i], b[j]); } }`;
    expect(hasNestedLoop(body)).toBe(true);
  });

  it('does not flag two sequential, non-nested loops', () => {
    const body = `for (let i = 0; i < a.length; i++) { touch(a[i]); }\nfor (let j = 0; j < b.length; j++) { touch(b[j]); }`;
    expect(hasNestedLoop(body)).toBe(false);
  });
});

describe('findValidationPatterns', () => {
  it('finds a validation keyword', () => {
    expect(findValidationPatterns('validateInput(payload);')).toContain('validate');
  });

  it('finds nothing when there is no such keyword', () => {
    expect(findValidationPatterns('return payload;')).toEqual([]);
  });
});

describe('extractTestDescriptions', () => {
  it('extracts it() and test() description strings', () => {
    const text = `it('returns null for missing id', () => {});\ntest("handles empty list", () => {});`;
    expect(extractTestDescriptions(text)).toEqual(['returns null for missing id', 'handles empty list']);
  });
});

describe('detectDirectoryRole', () => {
  it('detects a service directory', () => {
    expect(detectDirectoryRole('src/services/payment.ts')).toBe('service');
  });

  it('returns undefined for an unrecognized path', () => {
    expect(detectDirectoryRole('src/index.ts')).toBeUndefined();
  });
});

describe('parseChangedLines', () => {
  it('parses added lines from a unified diff', () => {
    const diff = [
      '--- a/foo.ts',
      '+++ b/foo.ts',
      '@@ -1,2 +1,3 @@',
      ' unchanged',
      '+added line',
      ' unchanged2',
    ].join('\n');
    const changed = parseChangedLines(diff);
    expect(changed.has('foo.ts')).toBe(true);
    expect(changed.get('foo.ts')!.size).toBeGreaterThan(0);
  });
});

describe('findFunctionTouchedByLines', () => {
  it('picks the function whose range overlaps a changed line', () => {
    const fns = extractFunctions('function a() {\n  return 1;\n}\nfunction b() {\n  return 2;\n}', 'f.ts');
    const touched = findFunctionTouchedByLines(fns, new Set([4]));
    expect(touched?.name).toBe('b');
  });
});
