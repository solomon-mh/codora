import type { CategoryBreakdownItem } from '../../shared/messages';
import { scoreTone } from '../../shared/aura';
import type { Tone } from '../../shared/aura';

const TONE_WORD: Record<Tone, string> = {
  good: 'Healthy',
  warning: 'Watch',
  high: 'Weak',
  critical: 'Critical',
};

/**
 * Categories as ruled rows, weakest first: a severity tag (only when the
 * score carries a verdict), the category, and its score. Untested
 * categories sink to the bottom and say so, rather than reading as zero.
 */
export function BreakdownBars({ breakdown }: { breakdown: CategoryBreakdownItem[] }): JSX.Element {
  const rows = [...breakdown].sort((a, b) => {
    if ((a.sampleCount > 0) !== (b.sampleCount > 0)) return a.sampleCount > 0 ? -1 : 1;
    return a.value - b.value;
  });

  return (
    <div className="cats" role="table" aria-label="Score by category">
      {rows.map((b) => {
        const tested = b.sampleCount > 0;
        const tone = tested ? scoreTone(b.value) : null;
        return (
          <div
            className="cat"
            key={b.category}
            role="row"
            title={tested ? `${b.label}: ${Math.round(b.value)} from ${b.sampleCount} answer${b.sampleCount === 1 ? '' : 's'}` : undefined}
          >
            <span className={`sev cat-sev${tone ? ` tone-${tone}` : ' faint'}`} role="cell">
              {tone ? TONE_WORD[tone] : 'Not asked'}
            </span>
            <span className="cat-name" role="rowheader">{b.label}</span>
            <span className="cat-value mono" role="cell">
              {tested ? Math.round(b.value) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
