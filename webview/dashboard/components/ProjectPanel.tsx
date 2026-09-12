import type { CategoryBreakdownItem, DashboardState } from '../../shared/messages';
import { IconAlert, IconCheck, IconCube, IconSpark } from '../../shared/Icons';
import { BreakdownBars } from './BreakdownBars';

export function ProjectPanel({
  project,
  breakdown,
}: {
  project: DashboardState['project'];
  breakdown: CategoryBreakdownItem[];
}): JSX.Element {
  const noSignal = project.strongCategories.length === 0 && project.weakCategories.length === 0;

  return (
    <>
      <div className="dash-stats">
        <div className="stat">
          <div className="stat-label">
            <IconCube size={13} />
            Project aura
          </div>
          <div className="stat-value">{project.aura !== null ? Math.round(project.aura) : '—'}</div>
          <div className="stat-foot">{project.name}</div>
        </div>
        <div className="stat">
          <div className="stat-label">
            <IconSpark size={13} />
            Challenges
          </div>
          <div className="stat-value">{project.challenges}</div>
          <div className="stat-foot">answered in this workspace</div>
        </div>
        <div className="stat">
          <div className="stat-label">
            <IconCheck size={13} />
            Strong areas
          </div>
          <div className="stat-value">{project.strongCategories.length}</div>
          <div className="stat-foot">scoring 80 or above</div>
        </div>
        <div className="stat">
          <div className="stat-label">
            <IconAlert size={13} />
            Needs work
          </div>
          <div className="stat-value">{project.weakCategories.length}</div>
          <div className="stat-foot">scoring below 60</div>
        </div>
      </div>

      <div className="dash-cols dash-cols-wide">
        <section className="panel">
          <div className="panel-head">
            <span className="panel-head-title c-label">Score by category</span>
          </div>
          {breakdown.length > 0 ? (
            <BreakdownBars breakdown={breakdown} />
          ) : (
            <div className="c-empty">
              <span className="c-empty-icon">
                <IconCube size={18} />
              </span>
              No category scores yet for this project.
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="panel-head-title c-label">Where you stand</span>
          </div>

          {noSignal ? (
            <div className="c-empty">
              <span className="c-empty-icon">
                <IconSpark size={18} />
              </span>
              Keep coding. Codora needs a little more activity before it can tell your
              strengths from your weak spots.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {project.strongCategories.length > 0 && (
                <div>
                  <div className="c-label" style={{ marginBottom: 8 }}>Strong</div>
                  <div className="set-chips">
                    {project.strongCategories.map((c) => (
                      <span className="c-pill c-pill-good" key={c} style={{ textTransform: 'capitalize' }}>
                        <IconCheck size={11} strokeWidth={2.4} />
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {project.weakCategories.length > 0 && (
                <div>
                  <div className="c-label" style={{ marginBottom: 8 }}>Needs work</div>
                  <div className="set-chips">
                    {project.weakCategories.map((c) => (
                      <span className="c-pill c-pill-critical" key={c} style={{ textTransform: 'capitalize' }}>
                        <IconAlert size={11} strokeWidth={2.2} />
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
