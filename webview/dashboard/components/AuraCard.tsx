import type { CategoryBreakdownItem } from '../../shared/messages';

export function AuraCard({
  aura,
  label,
  delta,
  hasEnoughData,
  breakdown,
  onStartChallenge,
}: {
  aura: number | null;
  label: string;
  delta: number | null;
  hasEnoughData: boolean;
  breakdown: CategoryBreakdownItem[];
  onStartChallenge: () => void;
}): JSX.Element {
  return (
    <div className="codora-card" style={{ marginBottom: 16 }}>
      <div className="codora-muted" style={{ fontSize: 12, marginBottom: 4 }}>Your Aura</div>
      {hasEnoughData ? (
        <>
          <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{Math.round(aura ?? 0)}</div>
          <div style={{ marginTop: 4, fontSize: 13 }}>{label}</div>
          {delta !== null && (
            <div className="codora-muted" style={{ fontSize: 12, marginTop: 2 }}>
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(0)}% this week
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>—</div>
          <div className="codora-muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 320 }}>
            You haven't completed enough challenges yet. Complete 3 challenges to unlock your first Aura score.
          </div>
          <button className="codora-btn" style={{ marginTop: 12 }} onClick={onStartChallenge}>
            Take a Challenge
          </button>
        </>
      )}

      {breakdown.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {breakdown.map((b) => (
            <div key={b.category} className="codora-bar-row">
              <span style={{ width: 90, textTransform: 'capitalize' }}>{b.label}</span>
              <div className="codora-bar-track">
                <div className="codora-bar-fill" style={{ width: `${Math.max(2, b.value)}%` }} />
              </div>
              <span className="codora-muted" style={{ width: 24, textAlign: 'right' }}>
                {b.sampleCount > 0 ? Math.round(b.value) : '–'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
