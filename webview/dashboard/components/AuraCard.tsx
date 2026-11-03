import type { CategoryBreakdownItem } from '../../shared/messages';
import { ScoreScale } from '../../shared/ScoreScale';
import { MeasureList } from '../../shared/Report';
import type { Measure } from '../../shared/Report';
import { AURA_BANDS, AURA_BOUNDARIES, auraTier, nextTierText, scoreTone } from '../../shared/aura';
import { BreakdownBars } from './BreakdownBars';

/** How well, in words, for each tier — the verdict is a sentence, not a label. */
const HOW_WELL: Record<string, string> = {
  Exceptional: 'exceptionally well',
  Excellent: 'very well',
  Strong: 'well',
  Developing: 'fairly well',
  'Needs attention': 'only in parts',
  Beginning: 'only a little so far',
};

/**
 * The reading: a verdict sentence, then the score on its ruler with the
 * week's measurements under it, and the categories worst-first beside it.
 */
export function AuraCard({
  scope,
  aura,
  hasEnoughData,
  breakdown,
  measures,
  onStartChallenge,
}: {
  scope: string;
  aura: number | null;
  hasEnoughData: boolean;
  breakdown: CategoryBreakdownItem[];
  measures: Measure[];
  onStartChallenge?: () => void;
}): JSX.Element {
  const value = Math.round(aura ?? 0);
  const tier = auraTier(value);
  const tested = breakdown.filter((b) => b.sampleCount > 0).sort((a, b) => b.value - a.value);
  const best = tested[0];
  const worst = tested[tested.length - 1];

  const verdict = !hasEnoughData
    ? 'No reading yet. Answer three challenges to get your first score.'
    : best && worst && best !== worst
      ? `You know your code ${HOW_WELL[tier.label]}. Strongest in ${best.label.toLowerCase()}, weakest in ${worst.label.toLowerCase()}.`
      : `You know your code ${HOW_WELL[tier.label]}.`;

  return (
    <section className="hero">
      <p className="meta">
        <span className="meta-strong">{scope}</span>
        <span>This week</span>
        {hasEnoughData && <span>{tier.label}</span>}
      </p>
      <h1 className="verdict hero-verdict">{verdict}</h1>

      {!hasEnoughData && onStartChallenge && (
        <button className="btn btn--primary hero-cta" onClick={onStartChallenge}>
          Take your first challenge
        </button>
      )}

      <div className="hero-grid">
        <div>
          {hasEnoughData && (
            <>
              <div className="reading">
                <span className="reading-value">{value}</span>
                <span className="reading-of">/100</span>
              </div>
              <div className="hero-scale">
                <ScoreScale
                  score={value}
                  tone={scoreTone(value)}
                  boundaries={AURA_BOUNDARIES}
                  bands={AURA_BANDS}
                  showTicks
                  showMarker
                />
              </div>
              <p className="hero-next muted">{nextTierText(tier)}</p>
            </>
          )}
          <MeasureList items={measures} />
        </div>

        <div>
          <p className="hero-side-title">Categories, weakest first</p>
          {breakdown.length > 0 ? (
            <BreakdownBars breakdown={breakdown} />
          ) : (
            <p className="muted">Each category gets a score after its first answer.</p>
          )}
        </div>
      </div>
    </section>
  );
}
