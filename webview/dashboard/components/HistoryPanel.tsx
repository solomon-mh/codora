import { useState } from 'react';
import type { HistoryItem } from '../../shared/messages';
import {
  IconCheck,
  IconChevronDown,
  IconFile,
  IconHistory,
  IconSpark,
  IconXCircle,
} from '../../shared/Icons';

export function HistoryPanel({ history }: { history: HistoryItem[] }): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <section className="panel">
        <div className="c-empty">
          <span className="c-empty-icon">
            <IconHistory size={18} />
          </span>
          No challenges answered yet. Once you answer one, it shows up here with the
          feedback and the files it came from.
        </div>
      </section>
    );
  }

  return (
    <div className="hist">
      {history.map((item) => {
        const open = openId === item.questionId;
        return (
          <article className={`hist-item${open ? ' is-open' : ''}`} key={item.questionId}>
            <button
              className="hist-btn"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : item.questionId)}
            >
              <span className={`hist-status ${item.correct ? 'is-correct' : 'is-missed'}`}>
                {item.correct ? <IconCheck size={14} strokeWidth={2.4} /> : <IconXCircle size={14} />}
              </span>

              <span className="hist-main">
                <span className="hist-meta">
                  <span
                    className="c-num"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: item.correct ? 'var(--good)' : 'var(--critical)',
                    }}
                  >
                    {Math.round(item.scorePct)}%
                  </span>
                  <span className="c-pill" style={{ textTransform: 'capitalize' }}>{item.category}</span>
                  <span className="c-pill" style={{ textTransform: 'capitalize' }}>{item.difficulty}</span>
                  {item.generatedBy === 'ai' && (
                    <span className="c-pill c-pill-accent">
                      <IconSpark size={10} />
                      AI
                    </span>
                  )}
                  <span className="c-muted" style={{ fontSize: 11, marginLeft: 'auto' }}>
                    {item.timestampLabel}
                  </span>
                </span>
                <span className="hist-prompt">{item.prompt}</span>
              </span>

              <IconChevronDown size={15} className="hist-chevron" />
            </button>

            {open && (
              <div className="hist-detail">
                {item.answerText && (
                  <div className="hist-detail-block">
                    <div className="c-label" style={{ marginBottom: 5 }}>Your answer</div>
                    {item.answerText}
                  </div>
                )}

                <div className="hist-detail-block">
                  <div className="c-label" style={{ marginBottom: 5 }}>Feedback</div>
                  {item.feedback}
                </div>

                {item.strengths.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {item.strengths.map((s) => (
                      <div key={s} style={{ display: 'flex', gap: 7, padding: '3px 0', color: 'var(--good)' }}>
                        <IconCheck size={13} strokeWidth={2.2} />
                        <span style={{ color: 'var(--fg-secondary)' }}>{s}</span>
                      </div>
                    ))}
                  </div>
                )}

                {item.gaps.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {item.gaps.map((g) => (
                      <div key={g} className="c-muted" style={{ display: 'flex', gap: 7, padding: '3px 0' }}>
                        <span style={{ color: 'var(--warn)' }}>·</span>
                        <span>{g}</span>
                      </div>
                    ))}
                  </div>
                )}

                {item.sourceFiles.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="c-label">From</span>
                    {item.sourceFiles.map((f) => (
                      <span className="hist-file" key={f}>
                        <IconFile size={11} />
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
