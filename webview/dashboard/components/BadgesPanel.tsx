import type { BadgeItem } from '../../shared/messages';
import { IconLock, IconMedal } from '../../shared/Icons';

export function BadgesPanel({ badges }: { badges: BadgeItem[] }): JSX.Element {
  const earned = badges.filter((b) => b.earned).length;

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="panel-head-title c-label">
          <IconMedal size={13} />
          Badges
        </span>
        <span className="c-pill panel-head-trailing c-num">
          {earned}/{badges.length}
        </span>
      </div>

      <div className="badges">
        {badges.map((b) => (
          <div className={`badge ${b.earned ? 'is-earned' : 'is-locked'}`} key={b.id} title={badgeTitle(b)}>
            <span className="badge-icon">{b.earned ? <IconMedal size={14} /> : <IconLock size={13} />}</span>
            <span style={{ minWidth: 0 }}>{b.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function badgeTitle(badge: BadgeItem): string {
  if (!badge.earned) return `${badge.label} — not earned yet`;
  if (!badge.earnedAt) return `${badge.label} — earned`;
  return `${badge.label} — earned ${new Date(badge.earnedAt).toLocaleDateString()}`;
}
