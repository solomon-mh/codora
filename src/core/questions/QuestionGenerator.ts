import type { FunctionInfo } from '../context/CodeContextExtractor';
import type { GeneratedQuestion, QuestionType } from './QuestionTypes';
import { generateRecall } from './templates/recall';
import { generatePrediction } from './templates/prediction';
import { generateCause } from './templates/cause';
import { generateDebugging } from './templates/debugging';
import { generateArchitecture } from './templates/architecture';
import { generateTesting } from './templates/testing';
import { generateSecurity } from './templates/security';
import { generatePerformance } from './templates/performance';

export interface FileContext {
  relativePath: string;
  text: string;
}

export interface TemplateContext {
  file: FileContext;
  fn?: FunctionInfo;
  testFile?: FileContext;
  commitMessage: string | null;
  now: number;
  isRetentionCheck: boolean;
}

type TemplateFn = (ctx: TemplateContext) => GeneratedQuestion | undefined;

const TEMPLATES: Record<QuestionType, TemplateFn> = {
  recall: generateRecall,
  prediction: generatePrediction,
  cause: generateCause,
  debugging: generateDebugging,
  architecture: generateArchitecture,
  testing: generateTesting,
  security: generateSecurity,
  performance: generatePerformance,
};

/**
 * Attempts to generate a question of the given type from this context.
 * Returns undefined if the static facts available aren't strong enough to
 * produce a defensible question (spec section 41) — callers must treat
 * that as "try a different type/context", never fall back to a guess.
 */
export function generateQuestion(type: QuestionType, ctx: TemplateContext): GeneratedQuestion | undefined {
  const question = TEMPLATES[type](ctx);
  return question ? { ...question, generatedBy: 'deterministic' } : undefined;
}

export const ALL_QUESTION_TYPES: QuestionType[] = [
  'recall',
  'prediction',
  'cause',
  'debugging',
  'architecture',
  'testing',
  'security',
  'performance',
];
