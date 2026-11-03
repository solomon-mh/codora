import type { Tone } from './aura';

const TONE_MARK: Record<Tone, string> = {
  good: 'var(--good-mark)',
  warning: 'var(--warning-mark)',
  high: 'var(--high-mark)',
  critical: 'var(--critical-mark)',
};

/**
 * A 0–100 score as a reading on a printed ruler (the same instrument as
 * traceOn's). A minor tick every 5 points, a long tick at each boundary
 * where the tier changes, the band up to the reading filled in its tone,
 * and an ink needle with a Signal Blue head. The needle travels from zero
 * once, on arrival — the one orchestrated motion on a screen. Boundaries
 * matter more than the fill: 69 and 71 look alike on a ring and sit in
 * different tiers here.
 */
export function ScoreScale({
  score,
  tone,
  boundaries = [],
  bands,
  showTicks = false,
  showMarker = false,
  height = 8,
  animate = true,
}: {
  score: number;
  tone: Tone;
  boundaries?: number[];
  /** Name the zone the reading falls in, under the ruler. Needs `showTicks`. */
  bands?: { from: number; to: number; label: string }[];
  showTicks?: boolean;
  showMarker?: boolean;
  height?: number;
  animate?: boolean;
}): JSX.Element {
  const pct = Math.max(0, Math.min(100, score));
  const minor = showTicks ? Array.from({ length: 21 }, (_, i) => i * 5) : [];
  const major = new Set([0, 100, ...boundaries]);
  const band = bands?.find((b) => pct >= b.from && (pct < b.to || (b.to === 100 && pct === 100)));

  return (
    <div className="scale" style={{ paddingTop: showMarker ? 14 : 0 }}>
      <div className="scale-track" style={{ height }}>
        <div
          className={`scale-fill${animate ? ' trace-draw' : ''}`}
          style={{ width: `${pct}%`, background: TONE_MARK[tone] }}
        />
        {!showTicks &&
          boundaries.map((b) => (
            <span key={b} className="scale-boundary" aria-hidden="true" style={{ left: `${b}%`, height }} />
          ))}
        {showMarker && (
          <span
            className={`scale-needle${animate ? ' needle-travel' : ''}`}
            aria-hidden="true"
            style={{ left: `${pct}%`, top: -14, height: height + 18 }}
          />
        )}
      </div>

      {showTicks && (
        <div className="scale-ticks" aria-hidden="true" style={{ height: band ? 46 : 26 }}>
          {minor.map((t) => (
            <span
              key={t}
              className={`scale-tick${major.has(t) ? ' is-major' : ''}`}
              style={{ left: `${t}%`, height: major.has(t) ? 9 : 4, marginLeft: t === 100 ? -1 : 0 }}
            />
          ))}
          {[...major]
            .sort((a, b) => a - b)
            .map((b) => (
              <span
                key={`n${b}`}
                className="scale-num"
                style={{ left: `${b}%`, transform: b === 0 ? 'none' : b === 100 ? 'translateX(-100%)' : 'translateX(-50%)' }}
              >
                {b}
              </span>
            ))}
          {band && (
            <span
              className="scale-band"
              style={{
                left: `${(band.from + band.to) / 2}%`,
                transform:
                  band.from === 0 ? 'translateX(-30%)' : band.to === 100 ? 'translateX(-70%)' : 'translateX(-50%)',
              }}
            >
              {band.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
