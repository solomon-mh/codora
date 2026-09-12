import { extractGuardClauses } from '../../context/CodeContextExtractor';
import { newId } from '../../../utils/id';
import type { GeneratedQuestion } from '../QuestionTypes';
import type { TemplateContext } from '../QuestionGenerator';

export function generatePrediction(ctx: TemplateContext): GeneratedQuestion | undefined {
  if (!ctx.fn || ctx.fn.params.length === 0) return undefined;
  const guards = extractGuardClauses(ctx.fn.body, ctx.fn.params);
  if (guards.length === 0) return undefined;

  const guard = guards[0];
  const correctText =
    guard.behavior === 'throw'
      ? `An error is thrown before the rest of the function runs`
      : `The function returns early (${truncate(guard.detail)})`;

  const options = shuffle([
    { id: 'a', text: correctText },
    { id: 'b', text: `The function proceeds normally, treating ${guard.paramName} as empty` },
    { id: 'c', text: `Nothing happens — execution silently continues` },
  ]);

  return {
    id: newId(),
    type: 'prediction',
    category: 'reasoning',
    difficulty: 'medium',
    prompt: `What happens if \`${guard.paramName}\` is missing when \`${ctx.fn.name}()\` executes?`,
    body: { kind: 'multiple-choice', options, correctOptionId: 'a' },
    provenance: {
      sourceFiles: [ctx.file.relativePath],
      sourceType: 'git-diff',
      reason: `\`${ctx.fn.name}\` guards against a missing \`${guard.paramName}\``,
      subjectFunction: ctx.fn.name,
    },
    isRetentionCheck: ctx.isRetentionCheck,
    createdAt: ctx.now,
  };
}

function truncate(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
