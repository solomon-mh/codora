import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type {
  ExtensionToSidebarMessage,
  SidebarState,
  SidebarToExtensionMessage,
} from '../shared/messages';
import {
  IconAura,
  IconClock,
  IconCube,
  IconFlame,
  IconGrid,
  IconPlay,
} from '../shared/Icons';

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
    return (
      <div className="side">
        <div className="c-skeleton" style={{ height: 86 }} />
        <div className="c-skeleton" style={{ height: 34 }} />
        <div className="c-skeleton" style={{ height: 60 }} />
      </div>
    );
  }

  return (
    <div className="side c-enter">
      <div className="side-brand">
        <span className="side-brand-mark">
          <IconAura size={13} strokeWidth={1.8} />
        </span>
        <span className="side-brand-name">Codora</span>
      </div>

      <div className="side-hero">
        <div className="c-label" style={{ marginBottom: 7 }}>Aura</div>
        <div className="side-hero-value">
          <span className="side-hero-number">
            {state.hasEnoughData ? Math.round(state.aura ?? 0) : '—'}
          </span>
          {state.hasEnoughData && <span className="c-muted" style={{ fontSize: 11 }}>/ 100</span>}
        </div>
        <div className="c-muted" style={{ fontSize: 11.5, marginTop: 4 }}>
          {state.hasEnoughData ? state.auraLabel : 'Not enough data yet'}
        </div>
        <div className="side-hero-foot">
          <span className={`c-streak${state.streakCurrent > 0 ? '' : ' is-zero'}`}>
            <IconFlame size={14} />
            <span className="c-streak-value">{state.streakCurrent}</span>
            <span className="c-streak-label">day streak</span>
          </span>
        </div>
      </div>

      <div className="side-actions">
        <button className="c-btn c-btn-block" onClick={() => vscode.postMessage({ type: 'startChallenge' })}>
          <IconPlay size={12} />
          Take a challenge
        </button>
        <button className="c-btn-ghost c-btn-block" onClick={() => vscode.postMessage({ type: 'openDashboard' })}>
          <IconGrid size={13} />
          Open dashboard
        </button>
      </div>

      {state.challengesPaused && (
        <div className="side-note">
          <IconClock size={13} />
          Challenges are paused
        </div>
      )}

      <Section title="Progress">
        {state.breakdown.length === 0 ? (
          <div className="c-muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>{state.insightHint}</div>
        ) : (
          state.breakdown.map((item) => (
            <div className="side-row" key={item.category}>
              <div className="side-row-head">
                <span className="side-row-name">{item.label}</span>
                <span className="side-row-value">
                  {item.sampleCount > 0 ? Math.round(item.value) : '–'}
                </span>
              </div>
              <div className="c-meter">
                {item.sampleCount > 0 && (
                  <div
                    className="c-meter-fill"
                    style={{ width: `${Math.max(3, Math.min(100, item.value))}%` }}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </Section>

      <Section title="Project">
        <div className="side-project" title={state.projectName}>
          <span style={{ color: 'var(--fg-faint)', display: 'flex' }}>
            <IconCube size={13} />
          </span>
          <span className="side-project-name">{state.projectName}</span>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div>
      <div className="c-label side-section-title">{title}</div>
      {children}
    </div>
  );
}
