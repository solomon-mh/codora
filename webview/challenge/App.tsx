import { useEffect, useRef, useState } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type {
  ChallengeSetupOption,
  ChallengeToExtensionMessage,
  ChallengeUnavailable,
  ExtensionToChallengeMessage,
} from '../shared/messages';
import type { GeneratedQuestion } from '../../src/core/questions/QuestionTypes';
import type { EvaluationResult } from '../../src/core/scoring/ScoreTypes';
import { IconArrowRight, IconKey, IconPlug, IconTerminal } from '../shared/Icons';
import { ModelBadge } from '../shared/ModelBadge';

const vscode = getVsCodeApi<ChallengeToExtensionMessage>();

const SUBMIT_KEYS = /Mac/.test(navigator.userAgent) ? '⌘ Enter' : 'Ctrl Enter';

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

  const canSubmit =
    !!question &&
    !result &&
    !submitting &&
    (question.body.kind === 'multiple-choice' ? !!selectedOption : freeText.trim().length > 0);

  const submit = () => {
    if (!question || !canSubmit) return;
    setSubmitting(true);
    const timing = { answeredAt: Date.now(), timeTakenMs: Date.now() - startedAt.current };
    vscode.postMessage({
      type: 'submitAnswer',
      payload:
        question.body.kind === 'multiple-choice'
          ? { questionId: question.id, kind: 'multiple-choice', selectedOptionId: selectedOption!, ...timing }
          : { questionId: question.id, kind: 'free-text', text: freeText, ...timing },
    });
  };

  // Number keys pick an answer; Ctrl/⌘+Enter checks it. Answering never needs the mouse.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitRef.current();
        return;
      }
      if (!question || result || question.body.kind !== 'multiple-choice') return;
      const typing =
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLInputElement && e.target.type !== 'radio');
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      const option = question.body.options[Number(e.key) - 1];
      if (option) setSelectedOption(option.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [question, result]);

  if (unavailable) return <UnavailableView state={unavailable} />;
  if (!question) return <LoadingView />;

  const { provenance } = question;
  const file = provenance.sourceFiles[0];

  return (
    <div className="chal">
      <p className="meta chal-meta">
        <span className="cap meta-strong">{question.category}</span>
        <span className="cap">{question.difficulty}</span>
        {question.isRetentionCheck && <span>Asked before</span>}
        <ModelBadge generator={question.generator} generatedBy={question.generatedBy} size={11} />
      </p>

      <h1 className="verdict-sm chal-question">{question.prompt}</h1>
      <p className="muted chal-reason">{provenance.reason}</p>

      {provenance.codeSnippet && (
        <figure className="chal-code">
          {file && (
            <figcaption className="chal-code-head" title={provenance.sourceFiles.join('\n')}>
              <span className="code chal-path">{file}</span>
              {provenance.subjectFunction && <span className="code faint">{provenance.subjectFunction}</span>}
            </figcaption>
          )}
          <pre className="chal-code-body" tabIndex={0} aria-label={`Code from ${file ?? 'your workspace'}`}>
            <code>{provenance.codeSnippet}</code>
          </pre>
        </figure>
      )}

      {question.body.kind === 'multiple-choice' && (
        <div className="choices" role="radiogroup" aria-label="Answers">
          {question.body.options.map((opt) => {
            const picked = selectedOption === opt.id;
            const state = !result
              ? ''
              : opt.text === result.correctOptionText || (picked && result.evaluation.correct)
                ? 'is-right'
                : picked
                  ? 'is-wrong'
                  : 'is-faded';
            return (
              <label className={`choice ${state}`} key={opt.id}>
                <input
                  type="radio"
                  name="answer"
                  className="sr-input"
                  checked={picked}
                  disabled={!!result}
                  onChange={() => setSelectedOption(opt.id)}
                />
                <span className="choice-radio" aria-hidden="true" />
                <span className="choice-text">{opt.text}</span>
                {state === 'is-right' && <span className="sev tone-good">{picked ? 'Your answer' : 'Answer'}</span>}
                {state === 'is-wrong' && <span className="sev tone-critical">Your answer</span>}
              </label>
            );
          })}
        </div>
      )}

      {question.body.kind === 'free-text' && !result && (
        <div className="chal-free">
          <textarea
            className="textarea"
            value={freeText}
            maxLength={question.body.maxLength}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Explain it in your own words"
            rows={6}
            autoFocus
          />
          <span className="chal-count mono faint">
            {freeText.length}/{question.body.maxLength}
          </span>
        </div>
      )}

      {!result && (
        <footer className="chal-foot">
          <span className="faint chal-hint">
            {question.body.kind === 'multiple-choice'
              ? `1–${question.body.options.length} to choose · ${SUBMIT_KEYS} to check`
              : `${SUBMIT_KEYS} to check`}
          </span>
          <button className="btn btn--primary" onClick={submit} disabled={!canSubmit}>
            {submitting ? 'Checking…' : 'Check answer'}
          </button>
        </footer>
      )}

      {result && <ResultView result={result} freeText={question.body.kind === 'free-text' ? freeText : undefined} />}
    </div>
  );
}

function LoadingView(): JSX.Element {
  return (
    <div className="chal">
      <span className="skeleton" style={{ height: 12, width: 180 }} />
      <span className="skeleton" style={{ height: 26, width: '80%', marginTop: 14 }} />
      <div className="chal-code chal-code-loading" aria-hidden="true">
        {[64, 48, 80, 36, 58].map((w, i) => (
          <span key={i} className="skeleton" style={{ height: 10, width: `${w}%` }} />
        ))}
      </div>
      <p className="muted">Reading your recent changes and writing a question…</p>
    </div>
  );
}

/**
 * Shown in place of a question when no model could write one. Occupies the
 * same space a question would, so the reason is impossible to miss, and
 * carries the action that actually resolves it.
 */
function UnavailableView({ state }: { state: ChallengeUnavailable }): JSX.Element {
  return (
    <div className="chal">
      <p className="meta chal-meta">
        <span className="sev tone-warning">No question this time</span>
      </p>
      <h1 className="verdict-sm chal-question">{state.title}</h1>
      <p className="muted chal-reason">{state.detail}</p>

      {state.setupOptions && state.setupOptions.length > 0 && (
        <div className="rows chal-setup">
          {state.setupOptions.map((option) => (
            <button
              key={option.kind}
              className="row"
              onClick={() => vscode.postMessage({ type: 'action', payload: option.kind })}
            >
              <span className="chal-setup-icon">{setupIcon(option)}</span>
              <span className="row-text">
                <strong>{option.label}</strong>
                <span className="row-hint">
                  {option.alreadyConfigured ? 'Already set up. Choose to replace it.' : option.hint}
                </span>
              </span>
              <IconArrowRight size={14} className="faint" />
            </button>
          ))}
        </div>
      )}

      <footer className="chal-foot">
        <button className="btn" onClick={() => vscode.postMessage({ type: 'close' })}>
          Close
        </button>
        <span className="chal-foot-actions">
          <button className="btn" onClick={() => vscode.postMessage({ type: 'retry' })}>
            Try again
          </button>
          {state.action && (
            <button
              className="btn btn--primary"
              onClick={() => vscode.postMessage({ type: 'action', payload: state.action!.kind })}
            >
              {state.action.label}
            </button>
          )}
        </span>
      </footer>
    </div>
  );
}

function setupIcon(option: ChallengeSetupOption): JSX.Element {
  if (option.kind === 'setup-vscode-lm') return <IconPlug size={15} />;
  if (option.kind === 'show-logs') return <IconTerminal size={15} />;
  return <IconKey size={15} />;
}

function ResultView({ result, freeText }: { result: ResultState; freeText?: string }): JSX.Element {
  const { evaluation, auraDelta } = result;
  const sectionRef = useRef<HTMLElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  // Bring the verdict into view and put focus on "Back to coding" without
  // letting the focus jump scroll the question off the top.
  useEffect(() => {
    sectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    doneRef.current?.focus({ preventScroll: true });
  }, []);
  const correct = evaluation.correct;
  const hasLists = evaluation.strengths.length > 0 || evaluation.gaps.length > 0;

  return (
    <section className="chal-result" aria-live="polite" ref={sectionRef}>
      <div className="chal-result-head">
        <h2 className={`verdict chal-verdict ${correct ? 'tone-good' : 'tone-critical'}`}>
          {correct ? 'Correct.' : 'Not quite.'}
        </h2>
        <dl className="chal-figures">
          <div>
            <dt className="faint">This answer</dt>
            <dd className="mono">{Math.round(evaluation.score * 100)}%</dd>
          </div>
          <div>
            <dt className="faint">Aura</dt>
            {/* A change that rounds to zero is "no change", never a green "+0.0". */}
            {Math.abs(auraDelta) < 0.05 ? (
              <dd className="mono faint">No change</dd>
            ) : (
              <dd className={`mono ${auraDelta > 0 ? 'tone-good' : 'tone-critical'}`}>
                {auraDelta > 0 ? '+' : '−'}
                {Math.abs(auraDelta).toFixed(1)}
              </dd>
            )}
          </div>
        </dl>
      </div>

      {freeText !== undefined && (
        <p className="chal-said">
          <strong>Your answer. </strong>
          <span className="muted">{freeText}</span>
        </p>
      )}

      <p className="chal-feedback">
        <strong>Why. </strong>
        {evaluation.feedback}
      </p>

      {hasLists && (
        <div className="chal-split">
          <div>
            <h3 className="chal-split-title">What you got right</h3>
            {evaluation.strengths.length > 0 ? (
              <ul className="bullets">
                {evaluation.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="faint">Nothing this time.</p>
            )}
          </div>
          <div>
            <h3 className="chal-split-title">Worth another look</h3>
            {evaluation.gaps.length > 0 ? (
              <ul className="bullets">
                {evaluation.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            ) : (
              <p className="faint">Nothing to revisit.</p>
            )}
          </div>
        </div>
      )}

      <footer className="chal-foot chal-foot-end">
        <button className="btn btn--primary" ref={doneRef} onClick={() => vscode.postMessage({ type: 'close' })}>
          Back to coding
        </button>
      </footer>
    </section>
  );
}
