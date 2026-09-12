import { useState } from 'react';
import type { DashboardState } from '../../shared/messages';
import { IconCheckCircle, IconFlame, IconGauge, IconSpark, IconTerminal } from '../../shared/Icons';
import type { IconProps } from '../../shared/Icons';

/** Monday = 0, matching the order DashboardData builds the weekly series in. */
const TODAY = (new Date().getDay() + 6) % 7;

export function WeekPanel({ thisWeek }: { thisWeek: DashboardState['thisWeek'] }): JSX.Element {
  return (
    <>
      <div className="dash-stats dash-section">
        <Stat
          label="Challenges"
          Icon={IconSpark}
          value={thisWeek.challengesCompleted}
          foot="answered this week"
        />
        <Stat
          label="Correct"
          Icon={IconCheckCircle}
          value={thisWeek.correctAnswers}
          foot={
            thisWeek.challengesCompleted > 0
              ? `of ${thisWeek.challengesCompleted} answered`
              : 'nothing answered yet'
          }
        />
        <Stat
          label="Accuracy"
          Icon={IconGauge}
          value={thisWeek.accuracyPct !== null ? `${thisWeek.accuracyPct}%` : '—'}
          foot={thisWeek.accuracyPct !== null ? 'this week' : 'needs an answer first'}
        />
        <Stat
          label="Sessions"
          Icon={IconTerminal}
          value={thisWeek.codingSessions}
          foot="coding sessions tracked"
        />
      </div>

      <section className="panel dash-section">
        <div className="panel-head">
          <span className="panel-head-title c-label">This week</span>
          <span
            className={`c-pill panel-head-trailing${thisWeek.currentStreak > 0 ? ' c-pill-streak' : ''}`}
          >
            <IconFlame size={11} />
            {thisWeek.currentStreak}d streak · best {thisWeek.bestStreak}d
          </span>
        </div>
        <WeekChart days={thisWeek.dailyChallengeCounts} />
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  foot,
  Icon,
}: {
  label: string;
  value: string | number;
  foot: string;
  Icon: (p: IconProps) => JSX.Element;
}): JSX.Element {
  return (
    <div className="stat">
      <div className="stat-label">
        <Icon size={13} />
        {label}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">{foot}</div>
    </div>
  );
}

/**
 * Challenges per day. One series, so no legend: the panel title names it.
 * Today carries the accent; days later in the week are drawn as a baseline
 * stub rather than a zero-height bar, so "not yet" doesn't look like "none".
 * The count is direct-labelled on hover and on today, never on all seven.
 */
function WeekChart({ days }: { days: { day: string; count: number }[] }): JSX.Element {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.count));
  const empty = days.every((d) => d.count === 0);

  return (
    <div className="chart">
      <div className="chart-plot">
        <div className="chart-grid" aria-hidden="true">
          <div className="chart-gridline" />
          <div className="chart-gridline" />
          <div className="chart-gridline" />
        </div>

        <div className="chart-bars">
          {days.map((d, i) => {
            const future = i > TODAY;
            const isToday = i === TODAY;
            const showLabel = hovered === i || (hovered === null && isToday && d.count > 0);
            const height = future ? 3 : Math.max(3, (d.count / max) * 100);

            return (
              <div
                key={d.day}
                className={`chart-col${isToday ? ' is-accent' : ''}`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                title={`${d.day}: ${future ? 'not yet' : `${d.count} challenge${d.count === 1 ? '' : 's'}`}`}
              >
                <div className="chart-bar-area">
                  {showLabel && !future && (
                    <span
                      className="c-tooltip"
                      style={{ left: '50%', bottom: `calc(${height}% + 7px)`, transform: 'translateX(-50%)' }}
                    >
                      {d.count}
                    </span>
                  )}
                  <div
                    className={`chart-bar${isToday && !future && d.count > 0 ? ' is-accent' : ''}`}
                    style={{ height: `${height}%`, opacity: future ? 0.45 : 1 }}
                  />
                </div>
                <span className="chart-xlabel">{d.day}</span>
              </div>
            );
          })}
        </div>
      </div>

      {empty && (
        <div className="c-muted" style={{ fontSize: 11.5, marginTop: 10, textAlign: 'center' }}>
          No challenges answered this week yet.
        </div>
      )}
    </div>
  );
}
