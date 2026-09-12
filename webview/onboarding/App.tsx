import { useState } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type { OnboardingToExtensionMessage } from '../shared/messages';

const vscode = getVsCodeApi<OnboardingToExtensionMessage>();

const ALL_CATEGORIES = ['recall', 'reasoning', 'debugging', 'architecture', 'testing', 'security', 'performance'];

export function App(): JSX.Element {
  const [interval, setInterval_] = useState<'10min' | '30min' | '1hour' | 'adaptive'>('30min');
  const [categories, setCategories] = useState<string[]>(ALL_CATEGORIES);

  const toggle = (c: string) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const start = () => {
    vscode.postMessage({ type: 'complete', payload: { challengeInterval: interval, categories } });
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>🧠 CODORA</div>
      <div style={{ fontSize: 16, marginBottom: 24 }}>Increase your aura by knowing what you code.</div>

      <p className="codora-muted">
        Codora periodically challenges your understanding of the code you're building.
      </p>
      <p style={{ fontWeight: 600 }}>
        AI is allowed. Not understanding your code isn't.
      </p>

      <div className="codora-card" style={{ marginTop: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Challenge frequency</div>
        {(['10min', '30min', '1hour', 'adaptive'] as const).map((opt) => (
          <label key={opt} style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }}>
            <input type="radio" checked={interval === opt} onChange={() => setInterval_(opt)} /> {labelFor(opt)}
          </label>
        ))}
      </div>

      <div className="codora-card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Challenge categories</div>
        {ALL_CATEGORIES.map((c) => (
          <label key={c} style={{ display: 'block', marginBottom: 6, cursor: 'pointer', textTransform: 'capitalize' }}>
            <input type="checkbox" checked={categories.includes(c)} onChange={() => toggle(c)} /> {c}
          </label>
        ))}
      </div>

      <div className="codora-card" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Privacy</div>
        <div className="codora-muted" style={{ fontSize: 12 }}>
          Your code stays on your machine by default. Codora does not upload your repository or
          source code without your explicit permission.
        </div>
      </div>

      <button className="codora-btn" onClick={start}>
        Start Codora
      </button>
    </div>
  );
}

function labelFor(opt: string): string {
  switch (opt) {
    case '10min': return '10 minutes';
    case '30min': return '30 minutes';
    case '1hour': return '1 hour';
    default: return 'Adaptive';
  }
}
