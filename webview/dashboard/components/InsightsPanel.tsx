import { IconBulb } from '../../shared/Icons';

export function InsightsPanel({ insights }: { insights: string[] }): JSX.Element {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-head-title c-label">
          <IconBulb size={13} />
          Insights
        </span>
      </div>

      {insights.length === 0 ? (
        <div className="c-empty">
          <span className="c-empty-icon">
            <IconBulb size={18} />
          </span>
          Keep answering challenges and Codora will start pointing out where your
          understanding is strongest and thinnest.
        </div>
      ) : (
        <div>
          {insights.map((insight) => (
            <div className="insight" key={insight}>
              <span className="insight-dot" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
