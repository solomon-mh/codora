import type { AIEvaluationPayload, AIGeneratedQuestionPayload, AIGenerationResult } from './AITypes';

/**
 * Extracts a JSON object from a model response, tolerating markdown code
 * fences or minor surrounding commentary a model might add despite being
 * told not to. Never throws — returns undefined on anything unparsable so
 * callers can fall back to deterministic templates/evaluation (spec
 * section 45: never crash because one subsystem fails).
 */
export function extractJsonObject(text: string): unknown | undefined {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1] : trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const braceMatch = candidate.match(/\{[\s\S]*\}/);
    if (!braceMatch) return undefined;
    try {
      return JSON.parse(braceMatch[0]);
    } catch {
      return undefined;
    }
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

const UNUSABLE = { outcome: 'unusable' } as const;

export function validateGenerationPayload(raw: unknown): AIGenerationResult {
  if (!raw || typeof raw !== 'object') return UNUSABLE;
  const obj = raw as Record<string, unknown>;

  // The model declining, via the skip signal the generation prompt itself
  // defines, is a well-formed answer meaning "this snippet doesn't support
  // this kind of question" — reported as its own outcome so it is never
  // shown to the developer as a malformed response.
  if (obj.skip === true) return { outcome: 'declined' };

  if (!isNonEmptyString(obj.prompt) || obj.prompt.length > 400) return UNUSABLE;
  if (obj.kind !== 'multiple-choice' && obj.kind !== 'free-text') return UNUSABLE;

  if (obj.kind === 'multiple-choice') {
    const options = obj.options;
    if (!Array.isArray(options) || options.length < 2 || options.length > 4) return UNUSABLE;
    const valid = options.every(
      (o) =>
        o &&
        typeof o === 'object' &&
        isNonEmptyString((o as Record<string, unknown>).id) &&
        isNonEmptyString((o as Record<string, unknown>).text),
    );
    if (!valid) return UNUSABLE;
    const ids = new Set((options as Array<{ id: string }>).map((o) => o.id));
    if (ids.size !== options.length) return UNUSABLE;
    if (!isNonEmptyString(obj.correctOptionId) || !ids.has(obj.correctOptionId)) return UNUSABLE;
  } else {
    const keywords = obj.rubricKeywords;
    if (!Array.isArray(keywords) || keywords.length === 0 || !keywords.every(isNonEmptyString)) {
      return UNUSABLE;
    }
  }

  return { outcome: 'question', payload: obj as unknown as AIGeneratedQuestionPayload };
}

export function validateEvaluationPayload(raw: unknown): AIEvaluationPayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.score !== 'number' || Number.isNaN(obj.score) || obj.score < 0 || obj.score > 1) return undefined;
  if (typeof obj.correct !== 'boolean') return undefined;
  if (typeof obj.confidence !== 'number') return undefined;
  if (!Array.isArray(obj.strengths) || !obj.strengths.every((s) => typeof s === 'string')) return undefined;
  if (!Array.isArray(obj.gaps) || !obj.gaps.every((g) => typeof g === 'string')) return undefined;
  if (!isNonEmptyString(obj.feedback)) return undefined;

  return obj as unknown as AIEvaluationPayload;
}
