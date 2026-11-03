import type { CodoraSettings } from '../../../src/core/storage/StorageSchema';
import type { AIStatus } from '../../../src/core/ai/AIProviderResolver';
import { Chip, ChoiceRow, SwitchRow, Tabs } from '../../shared/Controls';
import { Block } from '../../shared/Report';

const INTERVAL_OPTIONS: CodoraSettings['challengeInterval'][] = ['10min', '30min', '1hour', 'custom', 'adaptive', 'off'];
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
    <>
      <Block title="Model" note="Codora uses this model to write questions and to grade written answers.">
        <div className="rows">
          <div className="row">
            <span className="row-text">
              <span className={`sev ${ai.ok ? 'tone-good' : 'tone-warning'}`}>{ai.title}</span>
              <span className="row-hint">{ai.text}</span>
            </span>
            <button className="btn btn--sm" onClick={onConfigureAI}>
              {ai.ok ? 'Change model…' : 'Set up a model…'}
            </button>
          </div>
          <SwitchRow
            label="Use a model for challenges"
            description="Off means no challenges are offered."
            checked={settings.ai.enabled}
            onChange={(v) => onChange({ ai: { ...settings.ai, enabled: v } })}
          />
        </div>
      </Block>

      <Block title="How often" note="Counted in active coding time, so breaks don't count.">
        <div className="rows">
          {INTERVAL_OPTIONS.map((opt) => (
            <ChoiceRow
              key={opt}
              name="interval"
              label={intervalLabel(opt)}
              description={intervalHint(opt)}
              checked={settings.challengeInterval === opt}
              onChange={() => onChange({ challengeInterval: opt })}
              trailing={
                opt === 'custom' && settings.challengeInterval === 'custom' ? (
                  <span className="inline-field" onClick={(e) => e.preventDefault()}>
                    <input
                      type="number"
                      className="input mono"
                      min={1}
                      aria-label="Minutes between challenges"
                      value={settings.customIntervalMinutes}
                      onChange={(e) => onChange({ customIntervalMinutes: Math.max(1, Number(e.target.value) || 1) })}
                    />
                    minutes
                  </span>
                ) : undefined
              }
            />
          ))}
        </div>
      </Block>

      <Block title="Difficulty" note="Adaptive follows your recent scores in each category.">
        <Tabs<CodoraSettings['difficulty']>
          label="Question difficulty"
          active={settings.difficulty}
          onChange={(difficulty) => onChange({ difficulty })}
          items={[
            { id: 'adaptive', label: 'Adaptive' },
            { id: 'easy', label: 'Easy' },
            { id: 'medium', label: 'Medium' },
            { id: 'hard', label: 'Hard' },
          ]}
        />
      </Block>

      <Block
        title="Topics"
        count={`${settings.categories.length} of ${ALL_CATEGORIES.length}`}
        note="Codora only asks about the topics that are on."
      >
        <div className="chips">
          {ALL_CATEGORIES.map((c) => (
            <Chip key={c} label={c} checked={settings.categories.includes(c)} onChange={() => toggleCategory(c)} />
          ))}
        </div>
        {settings.categories.length === 0 && (
          <p className="tone-warning set-warning">Turn on at least one topic, or Codora has nothing to ask about.</p>
        )}
      </Block>

      <Block title="Notifications">
        <div className="rows">
          <SwitchRow
            label="Challenge ready"
            description="Tell me when a challenge is waiting."
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
        </div>
      </Block>

      <Block title="Your data" note="Deleting can't be undone.">
        <p className="callout">
          Your scores and history stay on this machine. To write a question, Codora sends one short snippet of recent
          code to your model, never your whole repository. Written answers go to the same model to be graded.
        </p>
        <div className="rows set-danger">
          <div className="row">
            <span className="row-text">
              Reset this project
              <span className="row-hint">Deletes this workspace's scores and history.</span>
            </span>
            <button className="btn btn--sm btn--danger" onClick={onResetProjectData}>
              Reset project data…
            </button>
          </div>
        </div>
      </Block>
    </>
  );
}

function intervalLabel(opt: CodoraSettings['challengeInterval']): string {
  switch (opt) {
    case '10min': return 'Every 10 minutes';
    case '30min': return 'Every 30 minutes';
    case '1hour': return 'Every hour';
    case 'custom': return 'Custom';
    case 'adaptive': return 'Adaptive';
    case 'off': return 'Off';
  }
}

function intervalHint(opt: CodoraSettings['challengeInterval']): string | undefined {
  switch (opt) {
    case 'adaptive': return 'Codora sets the gap from how you’ve been scoring.';
    case 'off': return 'No automatic challenges. You can still start one yourself.';
    default: return undefined;
  }
}

function aiDescription(status: AIStatus): { ok: boolean; title: string; text: string } {
  switch (status) {
    case 'claude-cli': return { ok: true, title: 'Claude Code', text: 'Using the Claude Code CLI and your Claude sign-in.' };
    case 'vscode-lm': return { ok: true, title: 'VS Code model', text: 'Using a VS Code language model, such as GitHub Copilot.' };
    case 'anthropic': return { ok: true, title: 'Anthropic', text: 'Using your Anthropic API key.' };
    case 'openai': return { ok: true, title: 'OpenAI', text: 'Using your OpenAI API key.' };
    case 'gemini': return { ok: true, title: 'Gemini', text: 'Using your Gemini API key.' };
    case 'none-configured': return { ok: false, title: 'No model set up', text: 'Codora can’t write questions until you choose one.' };
    case 'disabled': return { ok: false, title: 'Turned off', text: 'No challenges are offered while this is off.' };
  }
}
