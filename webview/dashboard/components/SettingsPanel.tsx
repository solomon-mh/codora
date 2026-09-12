import type { CodoraSettings } from '../../../src/core/storage/StorageSchema';

const INTERVAL_OPTIONS: CodoraSettings['challengeInterval'][] = ['10min', '30min', '1hour', 'adaptive', 'off'];
const DIFFICULTY_OPTIONS: CodoraSettings['difficulty'][] = ['adaptive', 'easy', 'medium', 'hard'];
const ALL_CATEGORIES = ['recall', 'reasoning', 'debugging', 'architecture', 'testing', 'security', 'performance'];

export function SettingsPanel({
  settings,
  onChange,
  onResetProjectData,
}: {
  settings: CodoraSettings;
  onChange: (patch: Partial<CodoraSettings>) => void;
  onResetProjectData: () => void;
}): JSX.Element {
  const toggleCategory = (c: string) => {
    const next = settings.categories.includes(c)
      ? settings.categories.filter((x) => x !== c)
      : [...settings.categories, c];
    onChange({ categories: next });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="codora-card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Challenge interval</div>
        {INTERVAL_OPTIONS.map((opt) => (
          <label key={opt} style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }}>
            <input
              type="radio"
              checked={settings.challengeInterval === opt}
              onChange={() => onChange({ challengeInterval: opt })}
            />{' '}
            {intervalLabel(opt)}
          </label>
        ))}
      </div>

      <div className="codora-card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Difficulty</div>
        {DIFFICULTY_OPTIONS.map((opt) => (
          <label key={opt} style={{ display: 'block', marginBottom: 6, cursor: 'pointer', textTransform: 'capitalize' }}>
            <input type="radio" checked={settings.difficulty === opt} onChange={() => onChange({ difficulty: opt })} /> {opt}
          </label>
        ))}
      </div>

      <div className="codora-card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Categories</div>
        {ALL_CATEGORIES.map((c) => (
          <label key={c} style={{ display: 'block', marginBottom: 6, cursor: 'pointer', textTransform: 'capitalize' }}>
            <input type="checkbox" checked={settings.categories.includes(c)} onChange={() => toggleCategory(c)} /> {c}
          </label>
        ))}
      </div>

      <div className="codora-card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Notifications</div>
        <Checkbox
          label="Challenge notifications"
          checked={settings.notifications.challenge}
          onChange={(v) => onChange({ notifications: { ...settings.notifications, challenge: v } })}
        />
        <Checkbox
          label="Daily progress"
          checked={settings.notifications.dailyProgress}
          onChange={(v) => onChange({ notifications: { ...settings.notifications, dailyProgress: v } })}
        />
        <Checkbox
          label="Weekly summary"
          checked={settings.notifications.weeklySummary}
          onChange={(v) => onChange({ notifications: { ...settings.notifications, weeklySummary: v } })}
        />
      </div>

      <div className="codora-card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Privacy</div>
        <div className="codora-muted" style={{ fontSize: 12 }}>
          Your code stays on your machine by default. Codora does not upload your repository or
          source code without your explicit permission.
        </div>
      </div>

      <div className="codora-card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Danger zone</div>
        <button className="codora-btn-secondary" onClick={onResetProjectData}>
          Reset project data
        </button>
      </div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <label style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

function intervalLabel(opt: CodoraSettings['challengeInterval']): string {
  switch (opt) {
    case '10min': return '10 minutes';
    case '30min': return '30 minutes';
    case '1hour': return '1 hour';
    case 'adaptive': return 'Adaptive';
    case 'off': return 'Off';
  }
}
