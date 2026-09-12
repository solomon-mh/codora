import { newId } from '../../../utils/id';
import type { GeneratedQuestion } from '../QuestionTypes';
import type { TemplateContext } from '../QuestionGenerator';

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'add', 'fix', 'update']);

/**
 * Open-ended fallback: "why did you make this change". Free-text, scored
 * by keyword overlap against real identifiers from the change (function
 * name, file name, commit message words) — never a fabricated rubric.
 */
export function generateCause(ctx: TemplateContext): GeneratedQuestion | undefined {
  const keywords = new Set<string>();
  if (ctx.fn) keywords.add(ctx.fn.name);
  keywords.add(baseName(ctx.file.relativePath));

  if (ctx.commitMessage) {
    for (const word of ctx.commitMessage.toLowerCase().split(/\s+/)) {
      const cleaned = word.replace(/[^a-z0-9]/g, '');
      if (cleaned.length > 3 && !STOPWORDS.has(cleaned)) keywords.add(cleaned);
    }
  }

  if (keywords.size === 0) return undefined;

  const subject = ctx.fn ? `\`${ctx.fn.name}\` in ${ctx.file.relativePath}` : ctx.file.relativePath;

  return {
    id: newId(),
    type: 'cause',
    category: 'reasoning',
    difficulty: 'medium',
    prompt: `Explain why you made this change to ${subject}.`,
    body: { kind: 'free-text', rubricKeywords: Array.from(keywords).slice(0, 6), maxLength: 500 },
    provenance: {
      sourceFiles: [ctx.file.relativePath],
      sourceType: 'git-diff',
      reason: 'Recently modified file with a commit message to reference',
    },
    isRetentionCheck: ctx.isRetentionCheck,
    createdAt: ctx.now,
  };
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1].replace(/\.[^.]+$/, '');
}
