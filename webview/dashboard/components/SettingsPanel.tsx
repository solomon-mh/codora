import type { ReactNode } from 'react';
import type { CodoraSettings } from '../../../src/core/storage/StorageSchema';
import type { AIStatus } from '../../../src/core/ai/AIProviderResolver';
import { Chip, RadioOption, SwitchRow } from '../../shared/Controls';
import {
  IconBell,
  IconClock,
  IconGauge,
  IconKey,
  IconLayers,
  IconShield,
  IconSpark,
  IconTrash,
} from '../../shared/Icons';
import type { IconProps } from '../../shared/Icons';

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

  const ai = aiDescription(aiStatus);

  return (
    <div className="set-stack">
      <Group icon={IconClock} title="Challenge interval" hint="How much active coding time passes between challenges.">
        <div className="set-group">
          {INTERVAL_OPTIONS.map((opt) => (
            <RadioOption
              key={opt}
              name="interval"
              label={intervalLabel(opt)}
              description={intervalHint(opt)}
              checked={settings.challengeInterval === opt}
              onChange={() => onChange({ challengeInterval: opt })}
              trailing={
                opt === 'custom' && settings.challengeInterval === 'custom' ? (
                  <span
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    onClick={(e) => e.preventDefault()}
                  >
                    <input
                      type="number"
                      className="c-input"
                      min={1}
                      style={{ width: 62 }}
                      value={settings.customIntervalMinutes}
                      onChange={(e) =>
                        onChange({ customIntervalMinutes: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                    <span className="c-muted" style={{ fontSize: 11.5 }}>min</span>
                  </span>
                ) : undefined
              }
            />
          ))}
        </div>
      </Group>

      <Group icon={IconGauge} title="Difficulty" hint="Adaptive tracks your recent scores per category.">
        <div className="set-group">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <RadioOption
              key={opt}
              name="difficulty"
              label={opt}
              capitalize
              checked={settings.difficulty === opt}
              onChange={() => onChange({ difficulty: opt })}
            />
          ))}
        </div>
      </Group>

      <Group icon={IconLayers} title="Categories" hint="Only enabled categories are ever asked about.">
        <div className="set-chips">
          {ALL_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              checked={settings.categories.includes(c)}
              onChange={() => toggleCategory(c)}
            />
          ))}
        </div>
        {settings.categories.length === 0 && (
          <div className="c-pill c-pill-critical" style={{ marginTop: 10 }}>
            No categories enabled — Codora has nothing to ask about.
          </div>
        )}
      </Group>

      <Group icon={IconBell} title="Notifications">
        <SwitchRow
          label="Challenge ready"
          description="Notify when a challenge is waiting."
          checked={settings.notifications.challenge}
          onChange={(v) => onChange({ notifications: { ...settings.notifications, challenge: v } })}
        />
        <SwitchRow
          label="Daily progress"
          checked={settings.notifications.dailyProgress}
          onChange={(v) => onChange({ notifications: { ...settings.notifications, dailyProgress: v } })}
        />
        <SwitchRow
          label="Weekly summary"
          checked={settings.notifications.weeklySummary}
          onChange={(v) => onChange({ notifications: { ...settings.notifications, weeklySummary: v } })}
        />
      </Group>

      <Group icon={IconSpark} title="AI-assisted challenges">
        <SwitchRow
          label="Use an AI model"
          description="Richer questions from your code, and free-text answers get evaluated."
          checked={settings.ai.enabled}
          onChange={(v) => onChange({ ai: { ...settings.ai, enabled: v } })}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 'var(--r-md)',
            background: 'var(--surface-inset)',
            border: '1px solid var(--border)',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              flex: 'none',
              background: ai.ok ? 'var(--good)' : 'var(--warn)',
              boxShadow: `0 0 0 3px ${ai.ok ? 'var(--good-soft)' : 'var(--warn-soft)'}`,
            }}
          />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>{ai.text}</span>
        </div>

        <button className="c-btn-ghost" style={{ marginTop: 12 }} onClick={onConfigureAI}>
          <IconKey size={13} />
          Configure provider
        </button>
      </Group>

      <Group icon={IconShield} title="Privacy">
        <p className="c-muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6 }}>
          Your code stays on your machine by default. Codora never uploads your repository
          or source code without your explicit permission. AI features are opt-in: when
          enabled, only a small, relevant snippet — never your whole repository — is sent to
          the model you configured.
        </p>
      </Group>

      <Group icon={IconTrash} title="Danger zone" hint="This cannot be undone.">
        <button className="c-btn-ghost c-btn-danger" onClick={onResetProjectData}>
          <IconTrash size={13} />
          Reset project data
        </button>
      </Group>
    </div>
  );
}

function Group({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: (p: IconProps) => JSX.Element;
  title: string;
  hint?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="panel">
      <div className="panel-head" style={{ marginBottom: hint ? 4 : 14 }}>
        <span className="panel-head-title c-label">
          <Icon size={13} />
          {title}
        </span>
      </div>
      {hint && (
        <p className="c-muted" style={{ margin: '0 0 14px', fontSize: 12 }}>
          {hint}
        </p>
      )}
      {children}
    </section>
  );
}

function intervalLabel(opt: CodoraSettings['challengeInterval']): string {
  switch (opt) {
    case '10min': return '10 minutes';
    case '30min': return '30 minutes';
    case '1hour': return '1 hour';
    case 'custom': return 'Custom';
    case 'adaptive': return 'Adaptive';
    case 'off': return 'Off';
  }
}

function intervalHint(opt: CodoraSettings['challengeInterval']): string | undefined {
  switch (opt) {
    case 'adaptive': return 'Codora picks the gap from how you have been scoring.';
    case 'off': return 'No automatic challenges — you can still start one by hand.';
    default: return undefined;
  }
}

function aiDescription(status: AIStatus): { ok: boolean; text: string } {
  switch (status) {
    case 'claude-cli': return { ok: true, text: 'Using the Claude Code CLI with your existing Claude sign-in.' };
    case 'vscode-lm': return { ok: true, text: 'Using a VS Code language model (for example GitHub Copilot).' };
    case 'anthropic': return { ok: true, text: 'Using your Anthropic API key.' };
    case 'openai': return { ok: true, text: 'Using your OpenAI API key.' };
    case 'gemini': return { ok: true, text: 'Using your Gemini API key.' };
    case 'none-configured': return { ok: false, text: 'Not configured — no challenges can be generated yet.' };
    case 'disabled': return { ok: false, text: 'Disabled — no challenges will be offered.' };
  }
}
