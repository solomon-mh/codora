import type { BadgeItem } from '../../shared/messages';
import { Block, MeasureList } from '../../shared/Report';

export function BadgesPanel({ badges }: { badges: BadgeItem[] }): JSX.Element {
  const earned = badges.filter((b) => b.earned).length;

  return (
    <Block title="Badges" count={`${earned} of ${badges.length}`}>
      <MeasureList
        items={badges.map((b) => ({
          label: b.label,
          value: b.earned ? (b.earnedAt ? `Earned ${new Date(b.earnedAt).toLocaleDateString()}` : 'Earned') : 'Not yet',
          tone: b.earned ? 'good' : undefined,
        }))}
      />
    </Block>
  );
}
