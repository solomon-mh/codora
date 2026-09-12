import React, { useEffect, useState } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type {
  ExtensionToSidebarMessage,
  SidebarState,
  SidebarToExtensionMessage,
} from '../shared/messages';

const vscode = getVsCodeApi<SidebarToExtensionMessage>();

export function App(): JSX.Element {
  const [state, setState] = useState<SidebarState | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToSidebarMessage>) => {
      if (event.data.type === 'state') setState(event.data.payload);
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  if (!state) {
    return <div style={{ padding: 16 }} className="codora-muted">Loading…</div>;
  }

  return (
    <div style={{ padding: '12px' }}>
      <button className="codora-btn" style={{ width: '100%', marginBottom: 12 }} onClick={() => vscode.postMessage({ type: 'openDashboard' })}>
        🧠 Dashboard
      </button>

      <Section title="CHALLENGE">
        <RowButton label="Take a challenge now" onClick={() => vscode.postMessage({ type: 'startChallenge' })} />
        {state.challengesPaused && <div className="codora-muted" style={{ fontSize: 11, marginTop: 4 }}>Challenges are paused</div>}
      </Section>

      <Section title="PROGRESS">
        {state.breakdown.length === 0 && (
          <div className="codora-muted" style={{ fontSize: 12 }}>{state.insightHint}</div>
        )}
        {state.breakdown.map((item) => (
          <ProgressRow key={item.category} label={item.label} value={item.value} />
        ))}
      </Section>

      <Section title="PROJECT">
        <div style={{ fontSize: 12 }}>{state.projectName}</div>
      </Section>

      <div style={{ borderTop: '1px solid var(--codora-border)', marginTop: 16, paddingTop: 12 }}>
        <div style={{ fontSize: 12 }}>🔥 {state.streakCurrent} day streak</div>
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="codora-muted" style={{ fontSize: 11 }}>Aura</span>
          <span style={{ fontSize: 22, fontWeight: 600 }}>{state.hasEnoughData ? state.aura : '—'}</span>
        </div>
        {state.hasEnoughData && <div className="codora-muted" style={{ fontSize: 11 }}>{state.auraLabel}</div>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="codora-muted" style={{ fontSize: 10, letterSpacing: 0.5, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

function RowButton({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button className="codora-btn-secondary" style={{ width: '100%', textAlign: 'left' }} onClick={onClick}>
      {label}
    </button>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
        <span>{label}</span>
        <span className="codora-muted">{Math.round(value)}</span>
      </div>
      <div className="codora-progress-track">
        <div className="codora-progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
