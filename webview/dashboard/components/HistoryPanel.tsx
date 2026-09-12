import { useState } from 'react';
import type { HistoryItem } from '../../shared/messages';

export function HistoryPanel({ history }: { history: HistoryItem[] }): JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (history.length === 0) {
    return (
      <div className="codora-card">
        <div className="codora-muted" style={{ fontSize: 13 }}>No challenges answered yet.</div>
      </div>
    );
  }

  return (
    <div className="codora-card">
      {history.map((item) => (
        <div
          key={item.questionId}
          className="codora-history-item"
          onClick={() => setExpandedId(expandedId === item.questionId ? null : item.questionId)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: item.correct ? 'var(--codora-success)' : 'var(--codora-error)' }}>
              {item.correct ? '✓ Correct' : '✗ Missed'}
            </span>
            <span className="codora-muted">{item.timestampLabel}</span>
          </div>
          <div style={{ fontSize: 12, textTransform: 'capitalize' }} className="codora-muted">
            {item.category}
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{item.prompt}</div>
          <div className="codora-muted" style={{ fontSize: 11, marginTop: 2 }}>Score: {Math.round(item.scorePct)}%</div>

          {expandedId === item.questionId && (
            <div style={{ marginTop: 8, fontSize: 12 }}>
              {item.answerText && <div style={{ marginBottom: 6 }}>Your answer: {item.answerText}</div>}
              <div className="codora-muted">{item.feedback}</div>
              {item.sourceFiles.length > 0 && (
                <div className="codora-muted" style={{ marginTop: 6 }}>Related: {item.sourceFiles.join(', ')}</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
