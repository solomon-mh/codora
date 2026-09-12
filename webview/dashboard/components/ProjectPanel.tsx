import type { DashboardState } from '../../shared/messages';

export function ProjectPanel({ project }: { project: DashboardState['project'] }): JSX.Element {
  return (
    <div className="codora-card">
      <div className="codora-muted" style={{ fontSize: 11, marginBottom: 4, letterSpacing: 0.5 }}>PROJECT</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{project.name}</div>
      <div style={{ marginBottom: 12 }}>
        Aura: <strong>{project.aura !== null ? Math.round(project.aura) : '—'}</strong>
        <span className="codora-muted"> · {project.challenges} challenges</span>
      </div>

      {project.strongCategories.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div className="codora-muted" style={{ fontSize: 11, marginBottom: 4 }}>Strong areas</div>
          {project.strongCategories.map((c) => (
            <div key={c} style={{ fontSize: 13, textTransform: 'capitalize' }}>✓ {c}</div>
          ))}
        </div>
      )}

      {project.weakCategories.length > 0 && (
        <div>
          <div className="codora-muted" style={{ fontSize: 11, marginBottom: 4 }}>Needs work</div>
          {project.weakCategories.map((c) => (
            <div key={c} style={{ fontSize: 13, textTransform: 'capitalize' }}>⚠ {c}</div>
          ))}
        </div>
      )}

      {project.strongCategories.length === 0 && project.weakCategories.length === 0 && (
        <div className="codora-muted" style={{ fontSize: 13 }}>
          Keep coding. Codora needs a little more activity before it can identify your strengths and weaknesses.
        </div>
      )}
    </div>
  );
}
