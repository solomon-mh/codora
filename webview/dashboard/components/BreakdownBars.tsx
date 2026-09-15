import type { CategoryBreakdownItem } from '../../shared/messages';

/**
 * Per-category comprehension scores as horizontal bars.
 *
 * One series, so length alone carries the magnitude and every bar wears the
 * same accent — color here would encode nothing. A category with no answers
 * yet gets a hatched track and a dash instead of a zero-length bar, so
 * "untested" never reads as "scored zero".
 */
export function BreakdownBars({ breakdown }: { breakdown: CategoryBreakdownItem[] }): JSX.Element {
  return (
    <div className="bd-rows" role="table" aria-label="Score by category">
      {breakdown.map((b) => {
        const tested = b.sampleCount > 0;
        return (
          <div
            className="bd-row"
            key={b.category}
            role="row"
            title={
              tested
                ? `${b.label}: ${Math.round(b.value)} / 100 from ${b.sampleCount} answer${b.sampleCount === 1 ? '' : 's'}`
                : `${b.label}: no answers yet`
            }
          >
            <span className="bd-name" role="rowheader">{b.label}</span>
            <div className={`bd-track${tested ? '' : ' is-empty'}`} role="cell">
              {tested && <div className="bd-fill" style={{ width: `${clamp(b.value)}%` }} />}
            </div>
            <span className="bd-value" role="cell" aria-label={tested ? undefined : 'no data'}>
              {tested ? Math.round(b.value) : '–'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function clamp(value: number): number {
  return Math.max(3, Math.min(100, value));
}
