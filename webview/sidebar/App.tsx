import { useEffect, useState } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type {
  ExtensionToSidebarMessage,
  SidebarState,
  SidebarToExtensionMessage,
} from '../shared/messages';
import { ScoreScale } from '../shared/ScoreScale';
import { MeasureList } from '../shared/Report';
import { AURA_BOUNDARIES, auraTier, nextTierText, scoreTone } from '../shared/aura';

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
        <div className="skeleton" style={{ height: 56, width: 120 }} />
        <div className="skeleton" style={{ height: 8 }} />
        <div className="skeleton" style={{ height: 34 }} />
      </div>
    );
  }

  const aura = Math.round(state.aura ?? 0);
  const tier = auraTier(aura);

  return (
    <div className="side">
      <section className="side-reading">
        <p className="meta">
          <span>Your aura</span>
          <span className="faint">{state.projectName}</span>
        </p>
        {state.hasEnoughData ? (
          <>
            <div className="reading">
              <span className="reading-value side-value">{aura}</span>
              <span className="reading-of">/100</span>
            </div>
            <ScoreScale score={aura} tone={scoreTone(aura)} boundaries={AURA_BOUNDARIES} height={6} animate={false} />
            <p className="side-tier">
              <strong>{tier.label}</strong>
              <span className="muted"> · {nextTierText(tier)}</span>
            </p>
          </>
        ) : (
          <>
            <p className="verdict-sm side-empty">No reading yet.</p>
            <p className="muted side-hint">Answer 3 challenges about your code to get your first score.</p>
          </>
        )}
      </section>

      <div className="side-actions">
        <button className="btn btn--primary btn--block" onClick={() => vscode.postMessage({ type: 'startChallenge' })}>
          Take a challenge
        </button>
        <button className="btn btn--block" onClick={() => vscode.postMessage({ type: 'openDashboard' })}>
          Open dashboard
        </button>
      </div>

      {state.challengesPaused && <p className="callout">Challenges are paused.</p>}

      <section>
        <h2 className="side-title">Categories</h2>
        {state.breakdown.length === 0 ? (
          <p className="muted side-hint">{state.insightHint}</p>
        ) : (
          <MeasureList
            items={state.breakdown.map((b) => ({
              label: b.label,
              value: b.sampleCount > 0 ? Math.round(b.value) : '—',
              tone: b.sampleCount > 0 && b.value < 60 ? scoreTone(b.value) : undefined,
            }))}
          />
        )}
      </section>

      <p className="side-foot">
        <span className={state.streakCurrent > 0 ? 'side-streak is-live' : 'side-streak'} />
        {state.streakCurrent}-day streak
      </p>
    </div>
  );
}
