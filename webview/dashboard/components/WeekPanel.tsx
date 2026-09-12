import type { DashboardState } from '../../shared/messages';

export function WeekPanel({ thisWeek }: { thisWeek: DashboardState['thisWeek'] }): JSX.Element {
  const maxCount = Math.max(1, ...thisWeek.dailyChallengeCounts.map((d) => d.count));

  return (
    <div className="codora-card" style={{ marginBottom: 16 }}>
      <div className="codora-muted" style={{ fontSize: 11, marginBottom: 10, letterSpacing: 0.5 }}>THIS WEEK</div>
      <div className="codora-grid-2" style={{ marginBottom: 16 }}>
        <Stat label="Coding sessions" value={thisWeek.codingSessions} />
        <Stat label="Challenges completed" value={thisWeek.challengesCompleted} />
        <Stat label="Correct answers" value={thisWeek.correctAnswers} />
        <Stat label="Accuracy" value={thisWeek.accuracyPct !== null ? `${thisWeek.accuracyPct}%` : '–'} />
        <Stat label="Current streak" value={`${thisWeek.currentStreak}d`} />
        <Stat label="Best streak" value={`${thisWeek.bestStreak}d`} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
        {thisWeek.dailyChallengeCounts.map((d) => (
          <div key={d.day} style={{ flex: 1, textAlign: 'center' }}>
            <div
              style={{
                height: `${Math.max(4, (d.count / maxCount) * 70)}px`,
                background: 'var(--codora-accent)',
                borderRadius: 3,
                marginBottom: 4,
              }}
              title={`${d.count} challenges`}
            />
            <div className="codora-muted" style={{ fontSize: 10 }}>{d.day}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{value}</div>
      <div className="codora-muted" style={{ fontSize: 11 }}>{label}</div>
    </div>
  );
}
