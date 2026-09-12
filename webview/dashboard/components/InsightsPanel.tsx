
export function InsightsPanel({ insights }: { insights: string[] }): JSX.Element {
  return (
    <div className="codora-card">
      <div className="codora-muted" style={{ fontSize: 11, marginBottom: 10, letterSpacing: 0.5 }}>INSIGHTS</div>
      {insights.length === 0 ? (
        <div className="codora-muted" style={{ fontSize: 13 }}>
          Keep answering challenges to unlock personalized insights.
        </div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {insights.map((insight) => (
            <li key={insight} style={{ marginBottom: 6, fontSize: 13 }}>{insight}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
