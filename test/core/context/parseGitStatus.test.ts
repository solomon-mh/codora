import { describe, it, expect } from 'vitest';
import { parsePorcelainZ } from '../../../src/core/context/parseGitStatus';

/** Builds `git status --porcelain -z` output from its entries. */
const z = (...entries: string[]) => entries.map((e) => `${e}\0`).join('');

describe('parsePorcelainZ', () => {
  it('keeps the whole path of a file edited but not staged', () => {
    // The common case right after an AI edits code: X is a space. Trimming
    // the entry before slicing used to cut the path's first character.
    expect(parsePorcelainZ(z(' M src/core/CodoraController.ts'))).toEqual(['src/core/CodoraController.ts']);
  });

  it('reads staged, staged-and-edited, added and untracked files', () => {
    expect(parsePorcelainZ(z('M  a.ts', 'MM b.ts', 'A  c.ts', '?? d.ts'))).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts']);
  });

  it('uses the new path of a rename and skips its original path', () => {
    expect(parsePorcelainZ(z('R  src/new.ts', 'src/old.ts', ' M other.ts'))).toEqual(['src/new.ts', 'other.ts']);
  });

  it('skips the source entry of a copy', () => {
    expect(parsePorcelainZ(z('C  copy.ts', 'original.ts'))).toEqual(['copy.ts']);
  });

  it('leaves out deleted files', () => {
    expect(parsePorcelainZ(z(' D gone.ts', 'D  also-gone.ts', ' M kept.ts'))).toEqual(['kept.ts']);
  });

  it('keeps paths with spaces and non-ASCII characters as they are', () => {
    expect(parsePorcelainZ(z(' M src/my file.ts', '?? docs/résumé.md'))).toEqual(['src/my file.ts', 'docs/résumé.md']);
  });

  it('returns nothing for a clean tree', () => {
    expect(parsePorcelainZ('')).toEqual([]);
  });
});
