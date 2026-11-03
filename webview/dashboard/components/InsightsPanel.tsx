import { Block } from '../../shared/Report';

export function InsightsPanel({ insights }: { insights: string[] }): JSX.Element {
  return (
    <Block title="Insights" count={insights.length || undefined} note="What Codora noticed from your answers.">
      {insights.length === 0 ? (
        <p className="muted">After a few more answers, Codora points out where you know your code best, and where it's thin.</p>
      ) : (
        <ul className="rows">
          {insights.map((insight) => (
            <li key={insight} className="row insight">
              {insight}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}
