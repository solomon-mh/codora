import React, { useEffect, useState } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type {
  DashboardState,
  DashboardToExtensionMessage,
  ExtensionToDashboardMessage,
} from '../shared/messages';
import { AuraCard } from './components/AuraCard';
import { WeekPanel } from './components/WeekPanel';
import { InsightsPanel } from './components/InsightsPanel';
import { ProjectPanel } from './components/ProjectPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { BadgesPanel } from './components/BadgesPanel';

const vscode = getVsCodeApi<DashboardToExtensionMessage>();

type Tab = 'overview' | 'history' | 'project' | 'settings';

export function App(): JSX.Element {
  const [state, setState] = useState<DashboardState | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToDashboardMessage>) => {
      if (event.data.type === 'state') setState(event.data.payload);
    };
    window.addEventListener('message', handler);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, []);

  if (!state) {
    return <div style={{ padding: 24 }} className="codora-muted">Loading…</div>;
  }

  return (
    <div className="codora-dashboard">
      <div className="codora-tabs">
        <Tab active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</Tab>
        <Tab active={tab === 'history'} onClick={() => setTab('history')}>History</Tab>
        <Tab active={tab === 'project'} onClick={() => setTab('project')}>Project</Tab>
        <Tab active={tab === 'settings'} onClick={() => setTab('settings')}>Settings</Tab>
      </div>

      {tab === 'overview' && (
        <>
          <AuraCard
            aura={state.globalAura}
            label={state.auraLabel}
            delta={state.auraDeltaThisWeek}
            hasEnoughData={state.hasEnoughData}
            breakdown={state.breakdown}
            onStartChallenge={() => vscode.postMessage({ type: 'startChallenge' })}
          />
          <WeekPanel thisWeek={state.thisWeek} />
          <InsightsPanel insights={state.insights} />
          <div style={{ marginTop: 16 }}>
            <BadgesPanel badges={state.badges} />
          </div>
        </>
      )}

      {tab === 'history' && <HistoryPanel history={state.history} />}

      {tab === 'project' && <ProjectPanel project={state.project} />}

      {tab === 'settings' && (
        <SettingsPanel
          settings={state.settings}
          aiStatus={state.aiStatus}
          onChange={(patch) => vscode.postMessage({ type: 'updateSettings', payload: patch })}
          onResetProjectData={() => vscode.postMessage({ type: 'resetProjectData' })}
          onConfigureAI={() => vscode.postMessage({ type: 'configureAI' })}
        />
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <button className={`codora-tab${active ? ' active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}
