import { Block } from '../../shared/Report';

/** Monday = 0, matching the order DashboardData builds the weekly series in. */
const TODAY = (new Date().getDay() + 6) % 7;

/**
 * Challenges per day, drawn on chart paper like any measurement against
 * time. Bars are ink; today is the Signal Blue pointer. Counts are printed
 * on the bars, so nothing hides behind a hover.
 */
export function WeekPanel({ days }: { days: { day: string; count: number }[] }): JSX.Element {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <Block title="This week" count={total} note="Challenges answered per day, Monday first.">
      <div className="paper week" role="img" aria-label="Challenges answered per day this week">
        {days.map((d, i) => {
          const future = i > TODAY;
          const height = future || d.count === 0 ? 0 : Math.max(6, (d.count / max) * 100);
          return (
            <div
              key={d.day}
              className={`week-col${i === TODAY ? ' is-today' : ''}${future ? ' is-future' : ''}`}
              title={`${d.day}: ${future ? 'not yet' : `${d.count} challenge${d.count === 1 ? '' : 's'}`}`}
            >
              <div className="week-plot">
                {!future && d.count > 0 && <span className="week-count mono">{d.count}</span>}
                <div className="week-bar" style={{ height: `${height}%` }} />
              </div>
              <span className="week-day">{d.day}</span>
            </div>
          );
        })}
      </div>
    </Block>
  );
}
