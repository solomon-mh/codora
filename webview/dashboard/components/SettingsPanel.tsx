import type { CodoraSettings } from '../../../src/core/storage/StorageSchema';
import type { AIStatus } from '../../../src/core/ai/AIProviderResolver';

const INTERVAL_OPTIONS: CodoraSettings['challengeInterval'][] = ['10min', '30min', '1hour', 'custom', 'adaptive', 'off'];
const DIFFICULTY_OPTIONS: CodoraSettings['difficulty'][] = ['adaptive', 'easy', 'medium', 'hard'];
const ALL_CATEGORIES = ['recall', 'reasoning', 'debugging', 'architecture', 'testing', 'security', 'performance'];

export function SettingsPanel({
  settings,
  aiStatus,
  onChange,
  onResetProjectData,
  onConfigureAI,
}: {
  settings: CodoraSettings;
  aiStatus: AIStatus;
  onChange: (patch: Partial<CodoraSettings>) => void;
  onResetProjectData: () => void;
  onConfigureAI: () => void;
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
          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, cursor: 'pointer' }}>
            <input
              type="radio"
              checked={settings.challengeInterval === opt}
              onChange={() => onChange({ challengeInterval: opt })}
            />
            {intervalLabel(opt)}
            {opt === 'custom' && settings.challengeInterval === 'custom' && (
              <>
                <input
                  type="number"
                  min={1}
                  value={settings.customIntervalMinutes}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onChange({ customIntervalMinutes: Math.max(1, Number(e.target.value) || 1) })}
                  style={{
                    width: 56,
                    background: 'var(--codora-card-bg)',
                    color: 'var(--codora-fg)',
                    border: '1px solid var(--codora-border)',
                    borderRadius: 4,
                    padding: '2px 6px',
                  }}
                />
                <span className="codora-muted">minutes</span>
              </>
            )}
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
        <div style={{ fontWeight: 600, marginBottom: 8 }}>AI-assisted challenges</div>
        <Checkbox
          label="Allow Codora to use an AI model for richer questions and evaluation"
          checked={settings.ai.enabled}
          onChange={(v) => onChange({ ai: { ...settings.ai, enabled: v } })}
        />
        <div className="codora-muted" style={{ fontSize: 12, marginTop: 6, marginBottom: 10 }}>
          Status: {aiStatusLabel(aiStatus)}
        </div>
        <button className="codora-btn-secondary" onClick={onConfigureAI}>
          Configure AI Provider
        </button>
      </div>

      <div className="codora-card">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Privacy</div>
        <div className="codora-muted" style={{ fontSize: 12 }}>
          Your code stays on your machine by default. Codora does not upload your repository or
          source code without your explicit permission. AI features are opt-in: when enabled, only
          a small, relevant code snippet — never your whole repository — is sent to whichever AI
          model you configure.
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
    case 'custom': return 'Custom:';
    case 'adaptive': return 'Adaptive';
    case 'off': return 'Off';
  }
}

function aiStatusLabel(status: AIStatus): string {
  switch (status) {
    case 'vscode-lm': return 'Using a VS Code Language Model (e.g. GitHub Copilot)';
    case 'anthropic': return 'Using a manually configured Anthropic API key';
    case 'openai': return 'Using a manually configured OpenAI API key';
    case 'gemini': return 'Using a manually configured Gemini API key';
    case 'none-configured': return 'Not configured — falling back to local deterministic challenges';
    case 'disabled': return 'Disabled — using local deterministic challenges only';
  }
}
