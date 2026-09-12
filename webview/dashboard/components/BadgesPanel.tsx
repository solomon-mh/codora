import type { BadgeItem } from '../../shared/messages';

export function BadgesPanel({ badges }: { badges: BadgeItem[] }): JSX.Element {
  return (
    <div className="codora-card">
      <div className="codora-muted" style={{ fontSize: 11, marginBottom: 10, letterSpacing: 0.5 }}>BADGES</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {badges.map((b) => (
          <div
            key={b.id}
            style={{
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--codora-border)',
              opacity: b.earned ? 1 : 0.4,
              fontSize: 12,
            }}
          >
            {b.earned ? '🏅' : '⬜'} {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
