import { extractReturnStatements } from '../../context/CodeContextExtractor';
import { newId } from '../../../utils/id';
import type { GeneratedQuestion } from '../QuestionTypes';
import type { TemplateContext } from '../QuestionGenerator';

const GENERIC_DISTRACTORS = ['undefined (no value)', 'It throws an error', 'An empty array'];

export function generateRecall(ctx: TemplateContext): GeneratedQuestion | undefined {
  if (!ctx.fn) return undefined;
  const returns = extractReturnStatements(ctx.fn.body);
  if (returns.length === 0) return undefined;

  const correct = returns[0];
  const distractors = GENERIC_DISTRACTORS.filter((d) => d.toLowerCase() !== correct.toLowerCase()).slice(0, 2);

  const options = [
    { id: 'a', text: correct },
    ...distractors.map((text, i) => ({ id: String.fromCharCode(98 + i), text })),
  ];

  return {
    id: newId(),
    type: 'recall',
    category: 'recall',
    difficulty: 'easy',
    prompt: `What does \`${ctx.fn.name}()\` return in this case?`,
    body: { kind: 'multiple-choice', options: shuffle(options), correctOptionId: 'a' },
    provenance: {
      sourceFiles: [ctx.file.relativePath],
      sourceType: 'git-diff',
      reason: `Recently modified function \`${ctx.fn.name}\``,
      subjectFunction: ctx.fn.name,
    },
    isRetentionCheck: ctx.isRetentionCheck,
    createdAt: ctx.now,
  };
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
