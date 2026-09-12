import { extractGuardClauses, findUnguardedPropertyAccess } from '../../context/CodeContextExtractor';
import { newId } from '../../../utils/id';
import type { GeneratedQuestion } from '../QuestionTypes';
import type { TemplateContext } from '../QuestionGenerator';

export function generateDebugging(ctx: TemplateContext): GeneratedQuestion | undefined {
  if (!ctx.fn || ctx.fn.params.length === 0) return undefined;

  const guards = extractGuardClauses(ctx.fn.body, ctx.fn.params);
  const guardedNames = new Set(guards.map((g) => g.paramName));
  const findings = findUnguardedPropertyAccess(ctx.fn.body, ctx.fn.params, guardedNames);
  if (findings.length === 0) return undefined;

  const finding = findings[0];
  const options = shuffle([
    { id: 'a', text: `\`${finding.param}\` is undefined or null when \`${finding.expression}\` is evaluated` },
    { id: 'b', text: `The function's return type is declared incorrectly` },
    { id: 'c', text: `The variable was renamed elsewhere in the file` },
  ]);

  return {
    id: newId(),
    type: 'debugging',
    category: 'debugging',
    difficulty: 'medium',
    prompt: `This function can throw on \`${finding.expression}\`. Which condition would cause that?`,
    body: { kind: 'multiple-choice', options, correctOptionId: 'a' },
    provenance: {
      sourceFiles: [ctx.file.relativePath],
      sourceType: 'git-diff',
      reason: `\`${finding.param}\` is accessed without a guard in \`${ctx.fn.name}\``,
      subjectFunction: ctx.fn.name,
    },
    isRetentionCheck: ctx.isRetentionCheck,
    createdAt: ctx.now,
  };
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
