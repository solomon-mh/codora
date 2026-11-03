import { useState } from 'react';
import type { HistoryItem } from '../../shared/messages';
import { IconChevronDown } from '../../shared/Icons';
import { ModelBadge } from '../../shared/ModelBadge';
import { Block } from '../../shared/Report';

export function HistoryPanel({
  history,
  onStartChallenge,
}: {
  history: HistoryItem[];
  onStartChallenge: () => void;
}): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <section className="hero">
        <h1 className="verdict hero-verdict">Nothing answered yet.</h1>
        <p className="muted hero-lede">Each challenge you answer is kept here, with its feedback and the files it came from.</p>
        <button className="btn btn--primary hero-cta" onClick={onStartChallenge}>
          Take a challenge
        </button>
      </section>
    );
  }

  const correct = history.filter((h) => h.correct).length;

  return (
    <Block title="Answered" count={history.length} note={`${correct} correct, newest first. Open one to see the feedback.`}>
      <ol className="rows">
        {history.map((item) => {
          const open = openId === item.questionId;
          return (
            <li className={`hist-item${open ? ' is-open' : ''}`} key={item.questionId}>
              <button className="row hist-row" aria-expanded={open} onClick={() => setOpenId(open ? null : item.questionId)}>
                <span className="row-text">
                  <span className="meta hist-meta">
                    <span className={`sev ${item.correct ? 'tone-good' : 'tone-critical'}`}>
                      {item.correct ? 'Correct' : 'Missed'}
                    </span>
                    <span className="cap">{item.category}</span>
                    <span className="cap">{item.difficulty}</span>
                    {item.generatedBy === 'ai' && <ModelBadge generator={item.generator} size={11} />}
                    <span className="faint">{item.timestampLabel}</span>
                  </span>
                  <span className="hist-prompt">{item.prompt}</span>
                </span>
                <span className={`hist-score mono ${item.correct ? 'tone-good' : 'tone-critical'}`}>
                  {Math.round(item.scorePct)}%
                </span>
                <IconChevronDown size={14} className="hist-chevron" />
              </button>

              {open && (
                <div className="hist-detail">
                  {item.sourceFiles.length > 0 && (
                    <p className="code hist-files">{item.sourceFiles.join('   ')}</p>
                  )}
                  {item.answerText && (
                    <p>
                      <strong>Your answer. </strong>
                      <span className="muted">{item.answerText}</span>
                    </p>
                  )}
                  <p>
                    <strong>Why. </strong>
                    {item.feedback}
                  </p>
                  {(item.strengths.length > 0 || item.gaps.length > 0) && (
                    <div className="hist-split">
                      <div>
                        <h3 className="hist-split-title">What you got right</h3>
                        {item.strengths.length > 0 ? (
                          <ul className="bullets">
                            {item.strengths.map((s) => (
                              <li key={s}>{s}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="faint">Nothing this time.</p>
                        )}
                      </div>
                      <div>
                        <h3 className="hist-split-title">Worth another look</h3>
                        {item.gaps.length > 0 ? (
                          <ul className="bullets">
                            {item.gaps.map((g) => (
                              <li key={g}>{g}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="faint">Nothing to revisit.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Block>
  );
}
