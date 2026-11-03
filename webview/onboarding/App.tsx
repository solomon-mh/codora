import { useState } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type { OnboardingToExtensionMessage } from '../shared/messages';
import { Chip, ChoiceRow } from '../shared/Controls';

const vscode = getVsCodeApi<OnboardingToExtensionMessage>();

const ALL_CATEGORIES = ['recall', 'reasoning', 'debugging', 'architecture', 'testing', 'security', 'performance'];

type Interval = '10min' | '30min' | '1hour' | 'adaptive';

const INTERVALS: { value: Interval; label: string; hint: string }[] = [
  { value: '10min', label: 'Every 10 minutes', hint: 'Best for short, focused sessions.' },
  { value: '30min', label: 'Every 30 minutes', hint: 'Most people start here.' },
  { value: '1hour', label: 'Every hour', hint: 'A light touch.' },
  { value: 'adaptive', label: 'Adaptive', hint: 'Codora sets the gap from how you score.' },
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
    <div className="onb">
      <p className="onb-wordmark">Codora</p>
      <h1 className="verdict onb-verdict">Know the code you ship.</h1>
      <p className="muted onb-lede">
        Every so often, Codora asks one short question about code you just worked on. Your aura is the reading of
        how well you know it, whether you wrote the code or an AI did.
      </p>

      <ol className="onb-steps">
        <li className="onb-step">
          <span className="onb-num">1</span>
          <div className="onb-step-body">
            <h2 className="onb-step-title">How often should Codora ask?</h2>
            <p className="muted onb-step-note">Counted in active coding time, so breaks don't count.</p>
            <div className="rows">
              {INTERVALS.map((opt) => (
                <ChoiceRow
                  key={opt.value}
                  name="interval"
                  label={opt.label}
                  description={opt.hint}
                  checked={interval === opt.value}
                  onChange={() => setInterval_(opt.value)}
                />
              ))}
            </div>
          </div>
        </li>

        <li className="onb-step">
          <span className="onb-num">2</span>
          <div className="onb-step-body">
            <h2 className="onb-step-title">What should it ask about?</h2>
            <p className={`onb-step-note ${categories.length === 0 ? 'tone-warning' : 'muted'}`}>
              {categories.length === 0 ? 'Pick at least one topic to continue.' : 'You can change any of this later in Settings.'}
            </p>
            <div className="chips">
              {ALL_CATEGORIES.map((c) => (
                <Chip key={c} label={c} checked={categories.includes(c)} onChange={() => toggle(c)} />
              ))}
            </div>
          </div>
        </li>
      </ol>

      <p className="callout onb-privacy">
        Your scores and history stay on this machine. To write a question, Codora sends one short snippet of recent
        code to the model you choose, never your whole repository. Written answers go to the same model to be graded.
      </p>

      <div className="onb-foot">
        <button className="btn btn--primary" onClick={start} disabled={categories.length === 0}>
          Start Codora
        </button>
      </div>
    </div>
  );
}
