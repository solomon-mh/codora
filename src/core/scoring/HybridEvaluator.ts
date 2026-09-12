import type { ChallengeAnswer, GeneratedQuestion } from '../questions/QuestionTypes';
import type { EvaluationResult } from './ScoreTypes';
import type { Evaluator } from './Evaluator';
import type { AIProvider } from '../ai/AITypes';
import { getLogger } from '../../utils/logger';

/**
 * Composes the deterministic evaluator with an optional AI provider.
 *
 * Multiple-choice answers are always scored deterministically — exact
 * match is objectively correct, so there's no benefit (and real risk) in
 * asking a model to judge it. AI is used only where deterministic scoring
 * is genuinely weak: open-ended free-text answers. Any AI failure
 * (network error, timeout, invalid response) falls straight back to the
 * deterministic evaluator rather than surfacing an error to the user.
 */
export class HybridEvaluator implements Evaluator {
  constructor(
    private readonly deterministic: Evaluator,
    private readonly getProvider: () => AIProvider | undefined,
  ) {}

  async evaluate(question: GeneratedQuestion, answer: ChallengeAnswer): Promise<EvaluationResult> {
    if (question.body.kind === 'multiple-choice') {
      return this.deterministic.evaluate(question, answer);
    }

    const provider = this.getProvider();
    if (!provider) {
      return this.deterministic.evaluate(question, answer);
    }

    try {
      const codeSnippet = question.provenance.codeSnippet;
      if (!codeSnippet) {
        return this.deterministic.evaluate(question, answer);
      }
      const payload = await provider.evaluateFreeText({
        questionPrompt: question.prompt,
        codeSnippet,
        category: question.category,
        developerAnswer: answer.text ?? '',
      });
      if (payload) return payload;
      getLogger().warn('AI evaluation returned no usable payload, falling back to deterministic', {
        provider: provider.id,
        preview: provider.getLastRawResponsePreview(),
      });
    } catch (err) {
      getLogger().warn('AI evaluation failed, falling back to deterministic', {
        provider: provider.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return this.deterministic.evaluate(question, answer);
  }
}
