import { useEffect, useRef, useState } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type {
  ChallengeToExtensionMessage,
  ChallengeUnavailable,
  ExtensionToChallengeMessage,
} from '../shared/messages';
import type { GeneratedQuestion } from '../../src/core/questions/QuestionTypes';
import type { EvaluationResult } from '../../src/core/scoring/ScoreTypes';

const vscode = getVsCodeApi<ChallengeToExtensionMessage>();

interface ResultState {
  evaluation: EvaluationResult;
  auraDelta: number;
  correctOptionText?: string;
}

export function App(): JSX.Element {
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [unavailable, setUnavailable] = useState<ChallengeUnavailable | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToChallengeMessage>) => {
      const msg = event.data;
      if (msg.type === 'question' || msg.type === 'followUp') {
        setQuestion(msg.payload);
        setUnavailable(null);
        setResult(null);
        setSelectedOption(null);
        setFreeText('');
        startedAt.current = Date.now();
      } else if (msg.type === 'unavailable') {
        setUnavailable(msg.payload);
        setQuestion(null);
        setResult(null);
      } else if (msg.type === 'result') {
        setResult(msg.payload);
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  if (unavailable) {
    return <UnavailableView state={unavailable} />;
  }

  if (!question) {
    return <div style={{ padding: 24 }} className="codora-muted">Preparing your challenge…</div>;
  }

  const submit = () => {
    if (question.body.kind === 'multiple-choice') {
      if (!selectedOption) return;
      vscode.postMessage({
        type: 'submitAnswer',
        payload: {
          questionId: question.id,
          kind: 'multiple-choice',
          selectedOptionId: selectedOption,
          answeredAt: Date.now(),
          timeTakenMs: Date.now() - startedAt.current,
        },
      });
    } else {
      vscode.postMessage({
        type: 'submitAnswer',
        payload: {
          questionId: question.id,
          kind: 'free-text',
          text: freeText,
          answeredAt: Date.now(),
          timeTakenMs: Date.now() - startedAt.current,
        },
      });
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          className="codora-muted"
          style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          🧠 Codora Challenge · {question.provenance.reason}
        </span>
        <span
          title={
            question.generatedBy === 'ai'
              ? 'Written by an AI model from your code'
              : 'Written by a local deterministic template — no AI involved'
          }
          style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            border: '1px solid var(--codora-border)',
            color: question.generatedBy === 'ai' ? 'var(--codora-accent)' : 'var(--codora-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {question.generatedBy === 'ai' ? '✨ AI-generated' : '📋 Local template'}
        </span>
      </div>

      <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 20 }}>{question.prompt}</div>

      {!result && question.body.kind === 'multiple-choice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {question.body.options.map((opt) => (
            <label
              key={opt.id}
              className="codora-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                borderColor: selectedOption === opt.id ? 'var(--codora-accent)' : undefined,
              }}
            >
              <input
                type="radio"
                name="option"
                checked={selectedOption === opt.id}
                onChange={() => setSelectedOption(opt.id)}
              />
              {opt.text}
            </label>
          ))}
        </div>
      )}

      {!result && question.body.kind === 'free-text' && (
        <div style={{ marginBottom: 20 }}>
          <textarea
            value={freeText}
            maxLength={question.body.maxLength}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Type your explanation…"
            rows={5}
            style={{
              width: '100%',
              background: 'var(--codora-card-bg)',
              color: 'var(--codora-fg)',
              border: '1px solid var(--codora-border)',
              borderRadius: 6,
              padding: 10,
              fontFamily: 'inherit',
              fontSize: 13,
              resize: 'vertical',
            }}
          />
          <div className="codora-muted" style={{ fontSize: 11, marginTop: 4, textAlign: 'right' }}>
            {freeText.length}/{question.body.maxLength}
          </div>
        </div>
      )}

      {!result && (
        <button
          className="codora-btn"
          onClick={submit}
          disabled={question.body.kind === 'multiple-choice' ? !selectedOption : freeText.trim().length === 0}
        >
          Submit Answer
        </button>
      )}

      {result && <ResultView result={result} onClose={() => vscode.postMessage({ type: 'close' })} />}
    </div>
  );
}

/**
 * Shown in place of a question when no AI provider could generate one.
 * Occupies the same space a question would, so the reason is impossible to
 * miss, and carries the action that actually resolves it.
 */
function UnavailableView({ state }: { state: ChallengeUnavailable }): JSX.Element {
  return (
    <div style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <div
        className="codora-muted"
        style={{ fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}
      >
        🧠 Codora Challenge
      </div>

      <div className="codora-card" style={{ borderColor: 'var(--codora-border)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>⚠ {state.title}</div>
        <div
          className="codora-muted"
          // pre-wrap: the detail may list one provider failure per line.
          style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16, whiteSpace: 'pre-wrap' }}
        >
          {state.detail}
        </div>

        {state.setupOptions && state.setupOptions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              className="codora-muted"
              style={{ fontSize: 10, letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}
            >
              Configure a provider
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {state.setupOptions.map((option) => (
                <button
                  key={option.kind}
                  className="codora-btn-secondary"
                  style={{ textAlign: 'left', padding: '8px 10px' }}
                  onClick={() => vscode.postMessage({ type: 'action', payload: option.kind })}
                >
                  <div style={{ fontSize: 13 }}>
                    {option.label}
                    {option.alreadyConfigured && (
                      <span className="codora-muted" style={{ fontSize: 11 }}> · already set up, replace</span>
                    )}
                  </div>
                  <div className="codora-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {option.hint}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {state.action && (
            <button
              className="codora-btn"
              onClick={() => vscode.postMessage({ type: 'action', payload: state.action!.kind })}
            >
              {state.action.label}
            </button>
          )}
          <button className="codora-btn-secondary" onClick={() => vscode.postMessage({ type: 'retry' })}>
            Try Again
          </button>
          <button className="codora-btn-secondary" onClick={() => vscode.postMessage({ type: 'close' })}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultView({ result, onClose }: { result: ResultState; onClose: () => void }): JSX.Element {
  const { evaluation, auraDelta } = result;
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, color: evaluation.correct ? 'var(--codora-success)' : 'var(--codora-fg)', marginBottom: 4 }}>
        {evaluation.correct ? '✓ Correct' : 'Not quite'}
      </div>
      <div className="codora-muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Aura {auraDelta >= 0 ? '+' : ''}{auraDelta.toFixed(1)}
      </div>
      <div style={{ marginBottom: 12 }}>{evaluation.feedback}</div>
      {evaluation.strengths.length > 0 && (
        <div style={{ marginBottom: 8, fontSize: 12 }}>
          {evaluation.strengths.map((s) => (
            <div key={s}>✓ {s}</div>
          ))}
        </div>
      )}
      {evaluation.gaps.length > 0 && (
        <div style={{ marginBottom: 16, fontSize: 12 }} className="codora-muted">
          {evaluation.gaps.map((g) => (
            <div key={g}>{g}</div>
          ))}
        </div>
      )}
      <button className="codora-btn-secondary" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
