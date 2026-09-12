import { findValidationPatterns } from '../../context/CodeContextExtractor';
import { newId } from '../../../utils/id';
import type { GeneratedQuestion } from '../QuestionTypes';
import type { TemplateContext } from '../QuestionGenerator';

const AUTH_KEYWORDS = new Set(['authenticate', 'authorize', 'verify', 'isAuthorized']);

export function generateSecurity(ctx: TemplateContext): GeneratedQuestion | undefined {
  if (!ctx.fn) return undefined;
  const matches = findValidationPatterns(ctx.fn.body);
  if (matches.length === 0) return undefined;

  const keyword = matches[0];
  const isAuth = AUTH_KEYWORDS.has(keyword);
  const correctText = isAuth
    ? 'A request could reach protected logic without proper authorization'
    : 'Malformed or malicious input could reach logic that assumes it is already clean';

  const options = shuffle([
    { id: 'a', text: correctText },
    { id: 'b', text: 'The function would run slightly slower' },
    { id: 'c', text: 'The bundled file size would increase' },
  ]);

  return {
    id: newId(),
    type: 'security',
    category: 'security',
    difficulty: 'hard',
    prompt: `What security risk could occur if the \`${keyword}\` check in \`${ctx.fn.name}\` were removed?`,
    body: { kind: 'multiple-choice', options, correctOptionId: 'a' },
    provenance: {
      sourceFiles: [ctx.file.relativePath],
      sourceType: 'git-diff',
      reason: `\`${ctx.fn.name}\` contains a \`${keyword}\`-style check`,
      subjectFunction: ctx.fn.name,
    },
    isRetentionCheck: ctx.isRetentionCheck,
    createdAt: ctx.now,
  };
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
