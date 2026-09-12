/**
 * Lightweight, regex/brace-matching static analysis — deliberately not a
 * full parser. It exists only to find *defensible, verifiable* facts
 * (an actual return statement, an actual guard clause) that the
 * deterministic question templates can build a question around, per spec
 * section 41 ("if Codora cannot confidently generate a useful question, do
 * not generate one"). When it can't find a clean signal, callers should
 * treat that as "skip", not "guess".
 */

export interface FunctionInfo {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  params: string[];
  body: string;
}

export interface GuardClause {
  paramName: string;
  behavior: 'return' | 'throw';
  detail: string;
}

const JS_FUNCTION_PATTERNS = [
  /function\s+(\w+)\s*\(([^)]*)\)/g,
  /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
  /(\w+)\s*\(([^)]*)\)\s*\{/g,
];

const JS_KEYWORDS_TO_SKIP = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'function',
  'return',
  'else',
]);

const PY_FUNCTION_PATTERN = /^(\s*)def\s+(\w+)\s*\(([^)]*)\):/;

export function extractFunctions(text: string, filePath: string): FunctionInfo[] {
  if (filePath.endsWith('.py')) {
    return extractPythonFunctions(text, filePath);
  }
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath)) {
    return extractJsFunctions(text, filePath);
  }
  return [];
}

function extractJsFunctions(text: string, filePath: string): FunctionInfo[] {
  const results: FunctionInfo[] = [];
  const seenStarts = new Set<number>();

  for (const pattern of JS_FUNCTION_PATTERNS) {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern);
    while ((match = re.exec(text))) {
      const name = match[1];
      if (JS_KEYWORDS_TO_SKIP.has(name)) continue;
      const openBraceIndex = text.indexOf('{', match.index + match[0].length - 1);
      if (openBraceIndex === -1) continue;
      const endIndex = findMatchingBrace(text, openBraceIndex);
      if (endIndex === -1) continue;
      if (seenStarts.has(match.index)) continue;
      seenStarts.add(match.index);

      const startLine = lineOf(text, match.index);
      const endLine = lineOf(text, endIndex);
      const params = (match[2] ?? '')
        .split(',')
        .map((p) => p.trim().split(/[=:\s]/)[0])
        .filter(Boolean);

      results.push({
        name,
        filePath,
        startLine,
        endLine,
        params,
        body: text.slice(openBraceIndex + 1, endIndex),
      });
    }
  }

  return dedupeByRange(results);
}

function extractPythonFunctions(text: string, filePath: string): FunctionInfo[] {
  const lines = text.split('\n');
  const results: FunctionInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = PY_FUNCTION_PATTERN.exec(lines[i]);
    if (!match) continue;
    const indent = match[1].length;
    const name = match[2];
    const params = match[3]
      .split(',')
      .map((p) => p.trim().split(/[=:\s]/)[0])
      .filter((p) => p && p !== 'self');

    let end = i + 1;
    while (end < lines.length) {
      const line = lines[end];
      if (line.trim() === '') {
        end++;
        continue;
      }
      const lineIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (lineIndent <= indent) break;
      end++;
    }

    results.push({
      name,
      filePath,
      startLine: i,
      endLine: end - 1,
      params,
      body: lines.slice(i + 1, end).join('\n'),
    });
  }

  return results;
}

export function findFunctionTouchedByLines(
  functions: FunctionInfo[],
  changedLines: Set<number>,
): FunctionInfo | undefined {
  return functions.find((fn) => {
    for (let line = fn.startLine; line <= fn.endLine; line++) {
      if (changedLines.has(line)) return true;
    }
    return false;
  });
}

const RETURN_PATTERN = /return\s+([^;\n]+)/g;

export function extractReturnStatements(body: string): string[] {
  const results = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(RETURN_PATTERN);
  while ((match = re.exec(body))) {
    const expr = match[1].trim();
    // A multi-line return (e.g. JSX's `return (` followed by a newline)
    // gets truncated at the newline, leaving just a stray opening bracket
    // — not a usable answer, so skip it rather than surface junk.
    if (!expr || /^[[({]+$/.test(expr)) continue;
    if (results.size < 6) results.add(expr);
  }
  return Array.from(results);
}

export function extractGuardClauses(body: string, params: string[]): GuardClause[] {
  const clauses: GuardClause[] = [];
  for (const param of params) {
    const notPattern = new RegExp(
      `if\\s*\\(\\s*!${param}[^)]*\\)\\s*\\{?\\s*(return[^;\\n]*|throw[^;\\n]*)`,
    );
    const nullPattern = new RegExp(
      `if\\s*\\(\\s*${param}\\s*(===|==)\\s*(null|undefined)[^)]*\\)\\s*\\{?\\s*(return[^;\\n]*|throw[^;\\n]*)`,
    );
    const notMatch = notPattern.exec(body);
    const nullMatch = nullPattern.exec(body);
    const hit = notMatch ?? nullMatch;
    if (hit) {
      const detailText = hit[hit.length - 1].trim();
      clauses.push({
        paramName: param,
        behavior: detailText.startsWith('throw') ? 'throw' : 'return',
        detail: detailText,
      });
    }
  }
  return clauses;
}

export function findUnguardedPropertyAccess(
  body: string,
  params: string[],
  guarded: Set<string>,
): { param: string; expression: string }[] {
  const findings: { param: string; expression: string }[] = [];
  for (const param of params) {
    if (guarded.has(param)) continue;
    const pattern = new RegExp(`\\b${param}\\.(\\w+)`);
    const match = pattern.exec(body);
    if (match) {
      findings.push({ param, expression: `${param}.${match[1]}` });
    }
  }
  return findings;
}

export function hasNestedLoop(body: string): boolean {
  const loopStarts = [...body.matchAll(/\b(for|while)\s*\(/g)];
  if (loopStarts.length < 2) return false;
  // Crude but real signal: two loop keywords where the second's index falls
  // before the first loop's matching closing brace.
  for (let i = 0; i < loopStarts.length - 1; i++) {
    const first = loopStarts[i];
    const openBrace = body.indexOf('{', first.index ?? 0);
    if (openBrace === -1) continue;
    const closeBrace = findMatchingBrace(body, openBrace);
    const next = loopStarts[i + 1];
    if (next.index !== undefined && closeBrace !== -1 && next.index < closeBrace) {
      return true;
    }
  }
  return false;
}

const VALIDATION_KEYWORDS = ['validate', 'sanitize', 'escape', 'authenticate', 'authorize', 'verify', 'isAuthorized'];

export function findValidationPatterns(body: string): string[] {
  return VALIDATION_KEYWORDS.filter((kw) => new RegExp(`\\b${kw}`, 'i').test(body));
}

const TEST_DESCRIPTION_PATTERN = /\b(?:it|test|describe)\(\s*(['"`])((?:(?!\1).)*)\1/g;

export function extractTestDescriptions(text: string): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(TEST_DESCRIPTION_PATTERN);
  while ((match = re.exec(text))) {
    results.push(match[2]);
  }
  return results;
}

export type DirectoryRole = 'service' | 'controller' | 'component' | 'model' | 'util' | 'middleware' | 'repository';

const ROLE_MARKERS: Array<[DirectoryRole, RegExp]> = [
  ['service', /\/services?\//i],
  ['controller', /\/controllers?\//i],
  ['component', /\/components?\//i],
  ['model', /\/models?\//i],
  ['middleware', /\/middlewares?\//i],
  ['repository', /\/repositor(y|ies)\//i],
  ['util', /\/utils?\//i],
];

export function detectDirectoryRole(filePath: string): DirectoryRole | undefined {
  const normalized = filePath.replace(/\\/g, '/');
  for (const [role, pattern] of ROLE_MARKERS) {
    if (pattern.test(`/${normalized}`)) return role;
  }
  return undefined;
}

// --- helpers ---

function findMatchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function lineOf(text: string, index: number): number {
  let line = 0;
  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

function dedupeByRange(functions: FunctionInfo[]): FunctionInfo[] {
  const seen = new Set<string>();
  return functions.filter((fn) => {
    const key = `${fn.startLine}:${fn.endLine}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Parses unified diff text into { filePath -> changed line numbers (new-file line numbers) }. */
export function parseChangedLines(diffText: string): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();
  let currentFile: string | null = null;
  let newLine = 0;

  for (const line of diffText.split('\n')) {
    const fileMatch = /^\+\+\+ b\/(.+)$/.exec(line);
    if (fileMatch) {
      currentFile = fileMatch[1];
      if (!result.has(currentFile)) result.set(currentFile, new Set());
      continue;
    }
    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunkMatch) {
      newLine = parseInt(hunkMatch[1], 10) - 1;
      continue;
    }
    if (!currentFile) continue;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      newLine++;
      result.get(currentFile)!.add(newLine - 1); // 0-indexed to match FunctionInfo lines
    } else if (!line.startsWith('-')) {
      newLine++;
    }
  }

  return result;
}
