import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type {
  ChallengeSetupOption,
  ChallengeToExtensionMessage,
  ChallengeUnavailable,
  ExtensionToChallengeMessage,
} from '../shared/messages';
import type { GeneratedQuestion } from '../../src/core/questions/QuestionTypes';
import type { EvaluationResult } from '../../src/core/scoring/ScoreTypes';
import {
  IconAlert,
  IconArrowRight,
  IconBulb,
  IconCheck,
  IconCheckCircle,
  IconFile,
  IconKey,
  IconRefresh,
  IconSpark,
  IconTarget,
  IconTerminal,
} from '../shared/Icons';

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
  const [submitting, setSubmitting] = useState(false);
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
        setSubmitting(false);
        startedAt.current = Date.now();
      } else if (msg.type === 'unavailable') {
        setUnavailable(msg.payload);
        setQuestion(null);
        setResult(null);
        setSubmitting(false);
      } else if (msg.type === 'result') {
        setResult(msg.payload);
        setSubmitting(false);
      }
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  if (unavailable) return <UnavailableView state={unavailable} />;

  if (!question) {
    return (
      <div className="chal">
        <Header />
        <div className="chal-loading">
          <span className="chal-spinner" />
          Reading your recent changes and writing a question…
        </div>
      </div>
    );
  }

  const submit = () => {
    setSubmitting(true);
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

  const canSubmit =
    question.body.kind === 'multiple-choice' ? !!selectedOption : freeText.trim().length > 0;
  // Only history records stored before local templates were removed say
  // 'deterministic', so an unset value on a live question means AI.
  const byAI = question.generatedBy !== 'deterministic';

  return (
    <div className="chal c-enter">
      <Header
        meta={
          <>
            <span className="c-pill" style={{ textTransform: 'capitalize' }}>{question.category}</span>
            <span className="c-pill" style={{ textTransform: 'capitalize' }}>{question.difficulty}</span>
            <span
              className={byAI ? 'c-pill c-pill-accent' : 'c-pill'}
              title={
                byAI
                  ? 'Written by an AI model from your code'
                  : 'Written by a local deterministic template — no AI involved'
              }
            >
              {byAI ? <IconSpark size={10} /> : <IconFile size={10} />}
              {byAI ? 'AI' : 'Template'}
            </span>
          </>
        }
      />

      <h1 className="chal-prompt">{question.prompt}</h1>

      {/* Why this question exists — supporting info, so it stays small and quiet. */}
      <p className="chal-reason">
        <IconBulb size={12} className="chal-reason-icon" />
        <span>{question.provenance.reason}</span>
      </p>

      {!result && question.body.kind === 'multiple-choice' && (
        <div className="chal-options">
          {question.body.options.map((opt) => (
            <label className="c-option chal-option" key={opt.id}>
              <input
                type="radio"
                className="c-radio"
                name="option"
                checked={selectedOption === opt.id}
                onChange={() => setSelectedOption(opt.id)}
              />
              <span className="c-option-text">{opt.text}</span>
            </label>
          ))}
        </div>
      )}

      {!result && question.body.kind === 'free-text' && (
        <div style={{ marginBottom: 22 }}>
          <textarea
            className="c-textarea"
            value={freeText}
            maxLength={question.body.maxLength}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Explain it in your own words…"
            rows={6}
            autoFocus
          />
          <div className="chal-counter">
            {freeText.length}/{question.body.maxLength}
          </div>
        </div>
      )}

      {!result && (
        <div className="chal-actions">
          <button className="c-btn" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? 'Checking…' : 'Submit answer'}
          </button>
          <span className="chal-hint">
            {canSubmit ? 'Your answer is scored against the code it came from.' : 'Pick or write an answer to continue.'}
          </span>
        </div>
      )}

      {result && <ResultView result={result} onClose={() => vscode.postMessage({ type: 'close' })} />}
    </div>
  );
}

function Header({ meta }: { meta?: ReactNode }): JSX.Element {
  return (
    <div className="chal-head">
      <span className="chal-mark">
        <IconSpark size={14} strokeWidth={1.8} />
      </span>
      <span className="chal-head-name">Codora Challenge</span>
      {meta && <span className="chal-head-meta">{meta}</span>}
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
    <div className="chal c-enter">
      <Header />

      <div className="chal-result-head is-missed">
        <span className="chal-result-icon is-missed">
          <IconAlert size={18} />
        </span>
        <span>
          <span className="chal-result-title" style={{ display: 'block' }}>{state.title}</span>
          <span className="c-muted" style={{ fontSize: 12 }}>No question could be generated.</span>
        </span>
      </div>

      <div className="chal-block">
        <div className="chal-detail">{state.detail}</div>
      </div>

      {state.setupOptions && state.setupOptions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="c-label" style={{ marginBottom: 8 }}>Configure a provider</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {state.setupOptions.map((option) => (
              <button
                key={option.kind}
                className="chal-setup-btn"
                onClick={() => vscode.postMessage({ type: 'action', payload: option.kind })}
              >
                <span className="chal-setup-icon">{setupIcon(option)}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13 }}>
                    {option.label}
                    {option.alreadyConfigured && (
                      <span className="c-muted" style={{ fontSize: 11 }}> · already set up, replace</span>
                    )}
                  </span>
                  <span className="c-muted" style={{ display: 'block', fontSize: 11.5, marginTop: 2 }}>
                    {option.hint}
                  </span>
                </span>
                <IconArrowRight size={15} className="chal-setup-arrow" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chal-actions">
        {state.action && (
          <button
            className="c-btn"
            onClick={() => vscode.postMessage({ type: 'action', payload: state.action!.kind })}
          >
            {state.action.label}
          </button>
        )}
        <button className="c-btn-ghost" onClick={() => vscode.postMessage({ type: 'retry' })}>
          <IconRefresh size={13} />
          Try again
        </button>
        <button className="c-btn-ghost" onClick={() => vscode.postMessage({ type: 'close' })}>
          Close
        </button>
      </div>
    </div>
  );
}

function setupIcon(option: ChallengeSetupOption): JSX.Element {
  if (option.kind === 'setup-vscode-lm') return <IconSpark size={14} />;
  if (option.kind === 'show-logs') return <IconTerminal size={14} />;
  return <IconKey size={14} />;
}

function ResultView({ result, onClose }: { result: ResultState; onClose: () => void }): JSX.Element {
  const { evaluation, auraDelta, correctOptionText } = result;
  const correct = evaluation.correct;

  return (
    <div className="c-enter">
      <div className={`chal-result-head ${correct ? 'is-correct' : 'is-missed'}`}>
        <span className={`chal-result-icon ${correct ? 'is-correct' : 'is-missed'}`}>
          {correct ? <IconCheckCircle size={20} /> : <IconTarget size={20} />}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="chal-result-title" style={{ display: 'block' }}>
            {correct ? 'Correct' : 'Not quite'}
          </span>
          <span className="c-muted" style={{ fontSize: 12 }}>
            {Math.round(evaluation.score * 100)}% on this answer
          </span>
        </span>
        <span className={`c-pill ${auraDelta >= 0 ? 'c-pill-good' : 'c-pill-critical'} c-num`}>
          {auraDelta >= 0 ? '+' : ''}
          {auraDelta.toFixed(1)} aura
        </span>
      </div>

      <div className="chal-block">{evaluation.feedback}</div>

      {!correct && correctOptionText && (
        <div className="chal-block">
          <div className="c-label" style={{ marginBottom: 6 }}>The answer</div>
          {correctOptionText}
        </div>
      )}

      {(evaluation.strengths.length > 0 || evaluation.gaps.length > 0) && (
        <div className="chal-block">
          {evaluation.strengths.map((s) => (
            <div className="chal-list-row" key={s}>
              <span className="chal-list-icon" style={{ color: 'var(--good)' }}>
                <IconCheck size={13} strokeWidth={2.4} />
              </span>
              <span>{s}</span>
            </div>
          ))}
          {evaluation.gaps.map((g) => (
            <div className="chal-list-row c-muted" key={g}>
              <span className="chal-list-icon" style={{ color: 'var(--warn)' }}>
                <IconAlert size={13} />
              </span>
              <span>{g}</span>
            </div>
          ))}
        </div>
      )}

      <div className="chal-actions">
        <button className="c-btn" onClick={onClose}>
          Done
        </button>
        <span className="chal-hint">Back to what you were doing.</span>
      </div>
    </div>
  );
}
