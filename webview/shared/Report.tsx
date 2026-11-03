import type { ReactNode } from 'react';
import type { Tone } from './aura';

/**
 * A section set like a page of a technical report: an ink rule across the
 * measure, a margin column holding the title, its count and its caveat,
 * and the evidence beside it. The block measures itself and stacks
 * wherever it is narrow.
 */
export function Block({
  title,
  count,
  note,
  aside,
  children,
}: {
  title: string;
  count?: string | number;
  note?: string;
  /** Actions or a key figure, hung in the margin under the title. */
  aside?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="rblock">
      <div className="rblock__grid">
        <div className="rblock__margin">
          <h2 className="rblock__title">
            {title}
            {count !== undefined && <span className="rblock__count">{count}</span>}
          </h2>
          {note && <p className="rblock__note">{note}</p>}
          {aside}
        </div>
        <div className="rblock__body">{children}</div>
      </div>
    </section>
  );
}

export interface Measure {
  label: string;
  value: string | number;
  /** Only when the value carries a verdict; a plain measurement stays ink. */
  tone?: Tone;
}

/** A run of measurements as aligned label/value rows on shared baselines. */
export function MeasureList({ items }: { items: Measure[] }): JSX.Element {
  return (
    <dl className="measures">
      {items.map((m) => (
        <div className="measure" key={m.label}>
          <dt className="measure-label">{m.label}</dt>
          <dd className={`measure-value${m.tone ? ` tone-${m.tone}` : ''}`}>{m.value}</dd>
        </div>
      ))}
    </dl>
  );
}
