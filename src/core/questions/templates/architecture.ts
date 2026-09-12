import { detectDirectoryRole, type DirectoryRole } from '../../context/CodeContextExtractor';
import { newId } from '../../../utils/id';
import type { GeneratedQuestion } from '../QuestionTypes';
import type { TemplateContext } from '../QuestionGenerator';

const RATIONALE: Record<DirectoryRole, string> = {
  service: 'Business logic and orchestration are kept separate from request handling, so they can be reused and tested independently of any transport layer.',
  controller: 'This layer translates incoming requests into calls on the underlying logic and shapes the response, without owning business rules itself.',
  component: 'UI rendering and user interaction are kept separate from data-fetching and business logic, so the view can be reused and tested in isolation.',
  model: 'This defines the shape and constraints of the data itself, independent of how it is fetched, displayed, or acted upon.',
  middleware: 'This runs as a shared step across many requests (auth, logging, validation) rather than being duplicated in every handler.',
  repository: 'Data-access details are isolated here so the rest of the app depends on an interface, not a specific storage mechanism.',
  util: 'This is stateless, reusable logic with no dependency on the rest of the application, kept separate so it can be reused anywhere.',
};

const ROLES = Object.keys(RATIONALE) as DirectoryRole[];

export function generateArchitecture(ctx: TemplateContext): GeneratedQuestion | undefined {
  const role = detectDirectoryRole(ctx.file.relativePath);
  if (!role) return undefined;

  const correctText = RATIONALE[role];
  const otherRoles = ROLES.filter((r) => r !== role);
  const distractors = shuffle(otherRoles)
    .slice(0, 2)
    .map((r) => RATIONALE[r]);

  const options = shuffle([
    { id: 'a', text: correctText },
    ...distractors.map((text, i) => ({ id: String.fromCharCode(98 + i), text })),
  ]);

  return {
    id: newId(),
    type: 'architecture',
    category: 'architecture',
    difficulty: 'hard',
    prompt: `Why is this logic implemented in the ${role} layer (${ctx.file.relativePath})?`,
    body: { kind: 'multiple-choice', options, correctOptionId: 'a' },
    provenance: {
      sourceFiles: [ctx.file.relativePath],
      sourceType: 'git-diff',
      reason: `File lives in a ${role}-style directory`,
    },
    isRetentionCheck: ctx.isRetentionCheck,
    createdAt: ctx.now,
  };
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
