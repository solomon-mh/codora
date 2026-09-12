import { extractGuardClauses, extractTestDescriptions } from '../../context/CodeContextExtractor';
import { newId } from '../../../utils/id';
import type { GeneratedQuestion } from '../QuestionTypes';
import type { TemplateContext } from '../QuestionGenerator';

export function generateTesting(ctx: TemplateContext): GeneratedQuestion | undefined {
  if (!ctx.fn || !ctx.testFile) return undefined;

  const descriptions = extractTestDescriptions(ctx.testFile.text);
  if (descriptions.length < 2) return undefined;

  const guards = extractGuardClauses(ctx.fn.body, ctx.fn.params);
  const uncoveredGuard = guards.find(
    (g) => !descriptions.some((d) => d.toLowerCase().includes(g.paramName.toLowerCase())),
  );
  if (!uncoveredGuard) return undefined;

  const covered = shuffle(descriptions).slice(0, 2);
  const uncoveredOption = `When \`${uncoveredGuard.paramName}\` is missing`;

  const options = shuffle([
    { id: 'a', text: uncoveredOption },
    ...covered.map((text, i) => ({ id: String.fromCharCode(98 + i), text })),
  ]);

  return {
    id: newId(),
    type: 'testing',
    category: 'testing',
    difficulty: 'medium',
    prompt: `Which edge case is NOT covered by the current tests for \`${ctx.fn.name}\`?`,
    body: { kind: 'multiple-choice', options, correctOptionId: 'a' },
    provenance: {
      sourceFiles: [ctx.file.relativePath, ctx.testFile.relativePath],
      sourceType: 'test-file',
      reason: `\`${ctx.fn.name}\` guards \`${uncoveredGuard.paramName}\` but no test description mentions it`,
      subjectFunction: ctx.fn.name,
    },
    isRetentionCheck: ctx.isRetentionCheck,
    createdAt: ctx.now,
  };
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
