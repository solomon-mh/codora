import type { CategoryBreakdownItem } from '../../shared/messages';
import { IconArrowDown, IconArrowUp, IconPlay, IconTarget } from '../../shared/Icons';
import { BreakdownBars } from './BreakdownBars';

/**
 * The headline number. A single value with a known ceiling (0-100) reads best
 * as a hero number inside a radial meter — the ring shows "how far along" at a
 * glance, and the number carries the precision.
 */
export function AuraCard({
  aura,
  label,
  delta,
  hasEnoughData,
  breakdown,
  accuracyPct,
  onStartChallenge,
}: {
  aura: number | null;
  label: string;
  delta: number | null;
  hasEnoughData: boolean;
  breakdown: CategoryBreakdownItem[];
  accuracyPct: number | null;
  onStartChallenge: () => void;
}): JSX.Element {
  const value = Math.round(aura ?? 0);

  return (
    <section className="panel c-card-lg">
      <div className="panel-head">
        <span className="panel-head-title c-label">
          <IconTarget size={13} />
          Your aura
        </span>
        <span className="c-pill">all workspaces</span>
        {hasEnoughData && delta !== null && (
          <span className={`c-pill panel-head-trailing ${delta >= 0 ? 'c-pill-good' : 'c-pill-critical'}`}>
            {delta >= 0 ? <IconArrowUp size={11} strokeWidth={2.2} /> : <IconArrowDown size={11} strokeWidth={2.2} />}
            {Math.abs(delta).toFixed(0)}% this week
          </span>
        )}
      </div>

      <div className="aura">
        <Ring value={hasEnoughData ? value : 0} dimmed={!hasEnoughData} />

        <div className="aura-body">
          {hasEnoughData ? (
            <>
              <div className="aura-label">{label}</div>
              <p className="c-muted" style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.55 }}>
                {accuracyPct !== null
                  ? `You've answered ${accuracyPct}% of this week's challenges correctly.`
                  : 'Your score blends accuracy, recency and difficulty across every category.'}
              </p>
            </>
          ) : (
            <>
              <div className="aura-label">No score yet</div>
              <p className="c-muted" style={{ margin: '6px 0 14px', fontSize: 12.5, lineHeight: 1.55, maxWidth: 380 }}>
                Answer 3 challenges to unlock your first aura score. Codora asks about the code
                you're actually writing, so the first few come quickly.
              </p>
              <button className="c-btn" onClick={onStartChallenge}>
                <IconPlay size={12} />
                Take a challenge
              </button>
            </>
          )}
        </div>
      </div>

      {breakdown.length > 0 && (
        <>
          <hr className="c-divider" style={{ margin: '18px 0 12px' }} />
          <div className="c-label" style={{ marginBottom: 8 }}>By category</div>
          <BreakdownBars breakdown={breakdown} />
        </>
      )}
    </section>
  );
}

/** Radial meter. Rounded cap and a 270°-of-100 sweep so low values are still visible. */
function Ring({ value, dimmed }: { value: number; dimmed: boolean }): JSX.Element {
  const r = 50;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circumference;

  return (
    <div className="aura-ring">
      <svg width="116" height="116" viewBox="0 0 116 116" aria-hidden="true">
        <defs>
          <linearGradient id="auraGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#3d8dc9" />
            <stop offset="100%" stopColor="#6cabdf" />
          </linearGradient>
        </defs>
        <circle cx="58" cy="58" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
        {!dimmed && (
          <circle
            cx="58"
            cy="58"
            r={r}
            fill="none"
            stroke="url(#auraGrad)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 58 58)"
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.32, 0.72, 0, 1)' }}
          />
        )}
      </svg>
      <div className="aura-ring-center">
        <span className="aura-ring-value">{dimmed ? '—' : value}</span>
        {!dimmed && <span className="c-muted" style={{ fontSize: 10.5 }}>/ 100</span>}
      </div>
    </div>
  );
}
