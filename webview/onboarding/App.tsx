import { useState } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type { OnboardingToExtensionMessage } from '../shared/messages';
import { Chip, RadioOption } from '../shared/Controls';
import { IconArrowRight, IconClock, IconLayers, IconShield, IconSpark } from '../shared/Icons';

const vscode = getVsCodeApi<OnboardingToExtensionMessage>();

const ALL_CATEGORIES = ['recall', 'reasoning', 'debugging', 'architecture', 'testing', 'security', 'performance'];

type Interval = '10min' | '30min' | '1hour' | 'adaptive';

const INTERVALS: { value: Interval; label: string; hint?: string }[] = [
  { value: '10min', label: '10 minutes', hint: 'Tight loop — best for short focused sessions.' },
  { value: '30min', label: '30 minutes', hint: 'A good default.' },
  { value: '1hour', label: '1 hour', hint: 'Light touch.' },
  { value: 'adaptive', label: 'Adaptive', hint: 'Codora picks the gap from how you score.' },
];

export function App(): JSX.Element {
  const [interval, setInterval_] = useState<Interval>('30min');
  const [categories, setCategories] = useState<string[]>(ALL_CATEGORIES);

  const toggle = (c: string) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const start = () => {
    vscode.postMessage({ type: 'complete', payload: { challengeInterval: interval, categories } });
  };

  return (
    <div className="onb c-enter">
      <div className="onb-mark">
        <IconSpark size={24} strokeWidth={1.7} />
      </div>

      <h1 className="onb-title">Codora</h1>
      <p className="onb-tagline">
        Increase your aura by knowing what you code. Codora periodically challenges your
        understanding of the code you're building.
      </p>
      <div className="onb-claim">
        <IconSpark size={14} />
        AI is allowed. Not understanding your code isn't.
      </div>

      <section className="onb-card">
        <div className="onb-card-title c-label">
          <IconClock size={13} />
          Challenge frequency
        </div>
        <p className="onb-card-hint">Measured in active coding time, not wall-clock time.</p>
        <div className="onb-options">
          {INTERVALS.map((opt) => (
            <RadioOption
              key={opt.value}
              name="interval"
              label={opt.label}
              description={opt.hint}
              checked={interval === opt.value}
              onChange={() => setInterval_(opt.value)}
            />
          ))}
        </div>
      </section>

      <section className="onb-card">
        <div className="onb-card-title c-label">
          <IconLayers size={13} />
          Challenge categories
        </div>
        <p className="onb-card-hint">You can change any of this later in settings.</p>
        <div className="set-chips">
          {ALL_CATEGORIES.map((c) => (
            <Chip key={c} label={c} checked={categories.includes(c)} onChange={() => toggle(c)} />
          ))}
        </div>
      </section>

      <div className="onb-privacy">
        <span className="onb-privacy-icon">
          <IconShield size={15} />
        </span>
        <span>
          Your code stays on your machine by default. Codora does not upload your repository
          or source code without your explicit permission.
        </span>
      </div>

      <div className="onb-foot">
        <button className="c-btn" onClick={start} disabled={categories.length === 0}>
          Start Codora
          <IconArrowRight size={13} />
        </button>
        <span className="c-muted" style={{ fontSize: 11.5 }}>
          {categories.length === 0
            ? 'Pick at least one category to continue.'
            : `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'} enabled`}
        </span>
      </div>
    </div>
  );
}
