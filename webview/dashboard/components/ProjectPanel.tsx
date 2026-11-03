import type { DashboardState } from '../../shared/messages';
import { Block, MeasureList } from '../../shared/Report';
import { AuraCard } from './AuraCard';

export function ProjectPanel({ project }: { project: DashboardState['project'] }): JSX.Element {
  const noSignal = project.strongCategories.length === 0 && project.weakCategories.length === 0;

  return (
    <>
      <AuraCard
        scope={project.name}
        aura={project.aura}
        hasEnoughData={project.aura !== null}
        breakdown={project.breakdown}
        measures={[
          { label: 'Answered in this workspace', value: project.challenges },
          { label: 'Strong areas (80 or more)', value: project.strongCategories.length },
          { label: 'Need work (under 60)', value: project.weakCategories.length },
        ]}
      />

      <Block title="Where you stand" note="Strong is 80 or more. Needs work is under 60.">
        {noSignal ? (
          <p className="muted">A few more answers here and Codora can tell your strong areas from the ones that need work.</p>
        ) : (
          <MeasureList
            items={[
              ...project.strongCategories.map((c) => ({ label: cap(c), value: 'Strong', tone: 'good' as const })),
              ...project.weakCategories.map((c) => ({ label: cap(c), value: 'Needs work', tone: 'critical' as const })),
            ]}
          />
        )}
      </Block>
    </>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
