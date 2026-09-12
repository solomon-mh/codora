import { hasNestedLoop } from '../../context/CodeContextExtractor';
import { newId } from '../../../utils/id';
import type { GeneratedQuestion } from '../QuestionTypes';
import type { TemplateContext } from '../QuestionGenerator';

export function generatePerformance(ctx: TemplateContext): GeneratedQuestion | undefined {
  if (!ctx.fn) return undefined;
  if (!hasNestedLoop(ctx.fn.body)) return undefined;

  const options = shuffle([
    { id: 'a', text: 'The nested loop, which repeats work per outer iteration and scales quadratically' },
    { id: 'b', text: 'Declaring the loop variable with `const` instead of `let`' },
    { id: 'c', text: 'The initial import statements at the top of the file' },
  ]);

  return {
    id: newId(),
    type: 'performance',
    category: 'performance',
    difficulty: 'hard',
    prompt: `What part of \`${ctx.fn.name}\` could become expensive for 10,000 records?`,
    body: { kind: 'multiple-choice', options, correctOptionId: 'a' },
    provenance: {
      sourceFiles: [ctx.file.relativePath],
      sourceType: 'git-diff',
      reason: `\`${ctx.fn.name}\` contains a nested loop`,
      subjectFunction: ctx.fn.name,
    },
    isRetentionCheck: ctx.isRetentionCheck,
    createdAt: ctx.now,
  };
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
