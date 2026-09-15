import { newId } from '../../utils/id';
import { getLogger } from '../../utils/logger';
import { isRetryableProviderError } from '../ai/classifyProviderError';
import { summarizeProviderError } from '../ai/summarizeProviderError';
import type { AIProvider } from '../ai/AITypes';
import type { FunctionInfo } from '../context/CodeContextExtractor';
import type {
  ChallengeCategory,
  Difficulty,
  FileContext,
  GeneratedQuestion,
  QuestionBody,
  QuestionType,
} from './QuestionTypes';

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
 *
 * `onFailure`, when given, receives a human-readable reason for the most
 * recent failure, plus whether retrying this provider could plausibly
 * help — used to surface *why* AI generation didn't work, and to stop
 * burning quota on a provider whose error (bad key, exhausted quota,
 * retired model) will fail identically every time.
 */
export async function tryGenerateAIQuestion(
  provider: AIProvider,
  category: ChallengeCategory,
  questionType: QuestionType,
  difficulty: Difficulty,
  candidate: AICandidate,
  isRetentionCheck: boolean,
  onFailure?: (reason: string, retryable: boolean) => void,
): Promise<GeneratedQuestion | undefined> {
  const codeSnippet = (candidate.fn?.body ?? candidate.file.text).slice(0, MAX_SNIPPET_CHARS).trim();
  if (!codeSnippet) return undefined;

  let result;
  try {
    result = await provider.generateQuestion({
      category,
      questionType,
      difficulty,
      filePath: candidate.file.relativePath,
      codeSnippet,
      changeReason: candidate.commitMessage ?? undefined,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const retryable = isRetryableProviderError(err);
    // Summarized, not verbatim: the untruncated error (a Gemini quota error
    // is ~1.5KB of nested JSON) gets logged once per attempt per provider
    // and drowns out everything else in the channel.
    getLogger().warn('AI question generation failed', {
      provider: provider.id,
      error: summarizeProviderError(reason),
      retryable,
    });
    onFailure?.(reason, retryable);
    return undefined;
  }
  // The model reading the snippet and judging it a poor fit for this
  // question type is the prompt working as designed, not a fault. Saying so
  // plainly matters: reported as a format error, a well-behaved model looks
  // broken, and the real signal — that this pairing of snippet and question
  // type was a dead end — is lost.
  if (result.outcome === 'declined') {
    getLogger().info('AI provider declined to ask about this snippet', {
      provider: provider.id,
      category,
      questionType,
      file: candidate.file.relativePath,
    });
    onFailure?.(
      `it judged ${candidate.file.relativePath} unsuitable for a ${questionType} question and declined to ask one`,
      true,
    );
    return undefined;
  }

  if (result.outcome === 'unusable') {
    const preview = provider.getLastRawResponsePreview();
    getLogger().warn('AI question generation returned no usable payload', { provider: provider.id, preview });
    // A different code snippet may well produce a valid question, so this
    // is worth another attempt — unlike an auth/quota error.
    onFailure?.(
      preview
        ? `the model's response didn't match the expected format — it said: "${preview}"`
        : 'the model returned an empty response',
      true,
    );
    return undefined;
  }

  const payload = result.payload;

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
    generatedBy: 'ai',
    generator: { providerId: provider.id, vendor: provider.vendor, modelName: provider.modelName },
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
