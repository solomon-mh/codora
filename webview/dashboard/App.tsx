import { useEffect, useState } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type {
  DashboardState,
  DashboardToExtensionMessage,
  ExtensionToDashboardMessage,
} from '../shared/messages';
import {
  IconAura,
  IconCube,
  IconFlame,
  IconGrid,
  IconHistory,
  IconPlay,
  IconSliders,
} from '../shared/Icons';
import type { IconProps } from '../shared/Icons';
import { AuraCard } from './components/AuraCard';
import { WeekPanel } from './components/WeekPanel';
import { InsightsPanel } from './components/InsightsPanel';
import { ProjectPanel } from './components/ProjectPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { BadgesPanel } from './components/BadgesPanel';

const vscode = getVsCodeApi<DashboardToExtensionMessage>();

type Tab = 'overview' | 'history' | 'project' | 'settings';

const NAV: { id: Tab; label: string; Icon: (p: IconProps) => JSX.Element }[] = [
  { id: 'overview', label: 'Overview', Icon: IconGrid },
  { id: 'history', label: 'History', Icon: IconHistory },
  { id: 'project', label: 'Project', Icon: IconCube },
  { id: 'settings', label: 'Settings', Icon: IconSliders },
];

const TAB_TITLE: Record<Tab, string> = {
  overview: 'Overview',
  history: 'History',
  project: 'Project',
  settings: 'Settings',
};

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

  if (!state) return <LoadingShell />;

  const activeIcon = NAV.find((n) => n.id === tab)?.Icon ?? IconGrid;
  const ActiveIcon = activeIcon;

  return (
    <div className="dash">
      <aside className="dash-rail">
        <div className="dash-brand">
          <span className="dash-brand-mark">
            <IconAura size={17} strokeWidth={1.8} />
          </span>
          <span className="dash-brand-name">Codora</span>
        </div>

        <nav className="dash-nav">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`dash-nav-item${tab === id ? ' is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={16} className="dash-nav-icon" />
              {label}
              {id === 'history' && state.history.length > 0 && (
                <span className="dash-nav-count">{state.history.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="dash-rail-spacer" />

        <div className="dash-rail-foot">
          <div>
            <div className="c-label" style={{ marginBottom: 6 }}>Aura</div>
            <div className="dash-rail-aura">
              <span className="dash-rail-aura-value">
                {state.hasEnoughData ? Math.round(state.globalAura ?? 0) : '—'}
              </span>
              {state.hasEnoughData && <span className="c-muted" style={{ fontSize: 11 }}>/ 100</span>}
            </div>
            <div className="c-muted" style={{ fontSize: 11.5, marginTop: 3 }}>
              {state.hasEnoughData ? state.auraLabel : 'Not enough data yet'}
            </div>
          </div>

          <hr className="c-divider" />

          <div className={`c-streak${state.thisWeek.currentStreak > 0 ? '' : ' is-zero'}`}>
            <IconFlame size={15} />
            <span className="c-streak-value">{state.thisWeek.currentStreak}</span>
            <span className="c-streak-label">day streak</span>
          </div>
        </div>
      </aside>

      <main className="dash-main">
        <div className="dash-main-inner">
          <div className="dash-topbar">
            <span className="dash-crumb">
              <ActiveIcon size={15} className="dash-crumb-icon" />
              {TAB_TITLE[tab]}
            </span>
            <span className="dash-topbar-meta">
              {state.thisWeek.challengesCompleted} challenge
              {state.thisWeek.challengesCompleted === 1 ? '' : 's'} this week
            </span>
            <div className="dash-topbar-actions">
              <button className="c-btn c-btn-sm" onClick={() => vscode.postMessage({ type: 'startChallenge' })}>
                <IconPlay size={12} />
                New challenge
              </button>
            </div>
          </div>

          {tab === 'overview' && (
            <div className="c-enter" key="overview">
              <h1 className="dash-greeting">{greeting()}</h1>
              <p className="dash-subgreeting">
                {state.hasEnoughData
                  ? `Your aura is ${state.auraLabel.toLowerCase()} across every workspace. You've answered ${
                      state.project.challenges
                    } challenge${state.project.challenges === 1 ? '' : 's'} in ${state.project.name}.`
                  : `Codora is still learning how well you know ${state.project.name}.`}
              </p>

              <AuraCard
                aura={state.globalAura}
                label={state.auraLabel}
                delta={state.auraDeltaThisWeek}
                hasEnoughData={state.hasEnoughData}
                breakdown={state.breakdown}
                accuracyPct={state.thisWeek.accuracyPct}
                onStartChallenge={() => vscode.postMessage({ type: 'startChallenge' })}
              />

              <WeekPanel thisWeek={state.thisWeek} />

              <div className="dash-cols dash-cols-wide">
                <InsightsPanel insights={state.insights} />
                <BadgesPanel badges={state.badges} />
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="c-enter" key="history">
              <h1 className="dash-greeting">History</h1>
              <p className="dash-subgreeting">Every challenge you've answered, newest first.</p>
              <HistoryPanel history={state.history} />
            </div>
          )}

          {tab === 'project' && (
            <div className="c-enter" key="project">
              <h1 className="dash-greeting">{state.project.name}</h1>
              <p className="dash-subgreeting">How well you know this workspace.</p>
              <ProjectPanel project={state.project} />
            </div>
          )}

          {tab === 'settings' && (
            <div className="c-enter" key="settings">
              <h1 className="dash-greeting">Settings</h1>
              <p className="dash-subgreeting">Tune when Codora interrupts you, and what it asks.</p>
              <SettingsPanel
                settings={state.settings}
                aiStatus={state.aiStatus}
                onChange={(patch) => vscode.postMessage({ type: 'updateSettings', payload: patch })}
                onResetProjectData={() => vscode.postMessage({ type: 'resetProjectData' })}
                onConfigureAI={() => vscode.postMessage({ type: 'configureAI' })}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

/** Mirrors the real layout so the panel doesn't visibly reflow once state lands. */
function LoadingShell(): JSX.Element {
  return (
    <div className="dash">
      <aside className="dash-rail">
        <div className="dash-brand">
          <span className="dash-brand-mark">
            <IconAura size={17} strokeWidth={1.8} />
          </span>
          <span className="dash-brand-name">Codora</span>
        </div>
        <div className="dash-nav">
          {NAV.map(({ id }) => (
            <div key={id} className="c-skeleton" style={{ height: 34 }} />
          ))}
        </div>
      </aside>
      <main className="dash-main">
        <div className="dash-main-inner">
          <div className="c-skeleton" style={{ height: 20, width: 180, marginBottom: 24 }} />
          <div className="c-skeleton" style={{ height: 36, width: 260, marginBottom: 22 }} />
          <div className="dash-stats">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="c-skeleton" style={{ height: 92 }} />
            ))}
          </div>
          <div className="c-skeleton" style={{ height: 220, marginTop: 14 }} />
        </div>
      </main>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up?';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
