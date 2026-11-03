import { useEffect, useState } from 'react';
import { getVsCodeApi } from '../shared/vscodeApi';
import type {
  DashboardState,
  DashboardToExtensionMessage,
  ExtensionToDashboardMessage,
} from '../shared/messages';
import { Tabs } from '../shared/Controls';
import { AuraCard } from './components/AuraCard';
import { WeekPanel } from './components/WeekPanel';
import { InsightsPanel } from './components/InsightsPanel';
import { ProjectPanel } from './components/ProjectPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { BadgesPanel } from './components/BadgesPanel';

const vscode = getVsCodeApi<DashboardToExtensionMessage>();

type Tab = 'overview' | 'history' | 'project' | 'settings';

const NAV: { group: string; items: { id: Tab; label: string }[] }[] = [
  { group: 'You', items: [{ id: 'overview', label: 'Overview' }, { id: 'history', label: 'History' }] },
  { group: 'This workspace', items: [{ id: 'project', label: 'Project' }] },
  { group: 'Preferences', items: [{ id: 'settings', label: 'Settings' }] },
];

const CRUMB: Record<Tab, [string, string]> = {
  overview: ['You', 'Overview'],
  history: ['You', 'History'],
  project: ['This workspace', 'Project'],
  settings: ['Preferences', 'Settings'],
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

  const startChallenge = () => vscode.postMessage({ type: 'startChallenge' });
  const historyCount = state?.history.length ?? 0;

  return (
    <div className="dash">
      <aside className="dash-rail">
        <div className="dash-wordmark">Codora</div>
        <nav className="dash-nav" aria-label="Dashboard">
          {NAV.map((section) => (
            <div key={section.group} className="dash-nav-group">
              <p className="dash-nav-label">{section.group}</p>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  className="nav-item"
                  aria-current={tab === item.id ? 'page' : undefined}
                  onClick={() => setTab(item.id)}
                >
                  <span className="pen" aria-hidden="true" />
                  {item.label}
                  {item.id === 'history' && historyCount > 0 && <span className="nav-count mono">{historyCount}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        {state && (
          <p className="dash-rail-foot">
            <span className={`dash-streak${state.thisWeek.currentStreak > 0 ? ' is-live' : ''}`} />
            {state.thisWeek.currentStreak}-day streak
          </p>
        )}
      </aside>

      <div className="dash-page">
        <header className="dash-head">
          <p className="dash-crumb">
            <span className="muted">{CRUMB[tab][0]}</span>
            <span className="faint">/</span>
            <strong>{CRUMB[tab][1]}</strong>
          </p>
          <div className="dash-head-right">
            {state && <span className="dash-project">{state.project.name}</span>}
            <button className="btn btn--primary" onClick={startChallenge}>
              Take a challenge
            </button>
          </div>
        </header>

        {/* Narrow panels drop the rail and switch sections with tabs instead. */}
        <div className="dash-tabs">
          <Tabs<Tab>
            label="Dashboard sections"
            active={tab}
            onChange={setTab}
            items={[
              { id: 'overview', label: 'Overview' },
              { id: 'history', label: 'History', count: historyCount },
              { id: 'project', label: 'Project' },
              { id: 'settings', label: 'Settings' },
            ]}
          />
        </div>

        <main className="dash-main">
          {!state ? (
            <>
              <div className="skeleton" style={{ height: 14, width: 220 }} />
              <div className="skeleton" style={{ height: 76, width: '70%' }} />
              <div className="skeleton" style={{ height: 160 }} />
            </>
          ) : (
            <>
              {tab === 'overview' && (
                <>
                  <AuraCard
                    scope="All workspaces"
                    aura={state.globalAura}
                    hasEnoughData={state.hasEnoughData}
                    breakdown={state.breakdown}
                    onStartChallenge={startChallenge}
                    measures={[
                      { label: 'Answered this week', value: state.thisWeek.challengesCompleted },
                      {
                        label: 'Correct this week',
                        value: state.thisWeek.accuracyPct !== null ? `${state.thisWeek.accuracyPct}%` : '—',
                      },
                      ...(state.auraDeltaThisWeek !== null
                        ? [
                            {
                              label: 'Change this week',
                              value: `${state.auraDeltaThisWeek >= 0 ? '+' : '−'}${Math.abs(state.auraDeltaThisWeek).toFixed(0)}%`,
                              tone: state.auraDeltaThisWeek >= 0 ? ('good' as const) : ('critical' as const),
                            },
                          ]
                        : []),
                      { label: 'Current streak', value: `${state.thisWeek.currentStreak} days` },
                      { label: 'Best streak', value: `${state.thisWeek.bestStreak} days` },
                      { label: 'Coding sessions', value: state.thisWeek.codingSessions },
                    ]}
                  />
                  <WeekPanel days={state.thisWeek.dailyChallengeCounts} />
                  <InsightsPanel insights={state.insights} />
                  <BadgesPanel badges={state.badges} />
                </>
              )}

              {tab === 'history' && <HistoryPanel history={state.history} onStartChallenge={startChallenge} />}

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
            </>
          )}
        </main>
      </div>
    </div>
  );
}
