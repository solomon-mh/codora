/**
 * Identifies "the same question subject", independent of exact
 * wording/id — used to avoid immediately repeating a question. Kept in
 * its own module (no vscode dependency) so it can be unit-tested without
 * pulling in the vscode-API-dependent parts of QuestionEngine.
 */
export function questionFingerprint(type: string, filePath: string, subjectFunction?: string): string {
  return `${type}:${filePath}:${subjectFunction ?? ''}`;
}
