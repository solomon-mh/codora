import { newId } from '../../utils/id';
import { getLogger } from '../../utils/logger';
import type { AIProvider } from '../ai/AITypes';
import type { FunctionInfo } from '../context/CodeContextExtractor';
import type { FileContext } from './QuestionGenerator';
import type { ChallengeCategory, Difficulty, GeneratedQuestion, QuestionBody, QuestionType } from './QuestionTypes';

const MAX_SNIPPET_CHARS = 3000;

export interface AICandidate {
  file: FileContext;
  fn?: FunctionInfo;
  commitMessage: string | null;
}

/**
 * Attempts to generate one question via an AI provider for the given
 * category/type. Returns undefined on any failure (network error,
 * timeout, unparseable/invalid response, or the model's own "skip") so the
 * caller falls straight through to the deterministic templates — the same
 * "skip rather than guess" contract every template already follows.
 */
export async function tryGenerateAIQuestion(
  provider: AIProvider,
  category: ChallengeCategory,
  questionType: QuestionType,
  difficulty: Difficulty,
  candidate: AICandidate,
  isRetentionCheck: boolean,
): Promise<GeneratedQuestion | undefined> {
  const codeSnippet = (candidate.fn?.body ?? candidate.file.text).slice(0, MAX_SNIPPET_CHARS).trim();
  if (!codeSnippet) return undefined;

  let payload;
  try {
    payload = await provider.generateQuestion({
      category,
      questionType,
      difficulty,
      filePath: candidate.file.relativePath,
      codeSnippet,
      changeReason: candidate.commitMessage ?? undefined,
    });
  } catch (err) {
    getLogger().warn('AI question generation threw', { provider: provider.id, error: String(err) });
    return undefined;
  }
  if (!payload) return undefined;

  const body: QuestionBody =
    payload.kind === 'multiple-choice'
      ? { kind: 'multiple-choice', options: payload.options!, correctOptionId: payload.correctOptionId! }
      : { kind: 'free-text', rubricKeywords: payload.rubricKeywords!, maxLength: 500 };

  return {
    id: newId(),
    type: questionType,
    category,
    difficulty,
    prompt: payload.prompt,
    body,
    provenance: {
      sourceFiles: [candidate.file.relativePath],
      sourceType: 'git-diff',
      reason: payload.reason || `AI-generated question about ${candidate.file.relativePath}`,
      subjectFunction: candidate.fn?.name,
      codeSnippet,
    },
    isRetentionCheck,
    createdAt: Date.now(),
  };
}
