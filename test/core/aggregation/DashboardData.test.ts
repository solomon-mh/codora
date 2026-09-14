import { describe, it, expect } from 'vitest';
import { buildDashboardState } from '../../../src/core/aggregation/DashboardData';
import { createDefaultRollingScores } from '../../../src/core/scoring/ScoreTypes';
import { defaultSettings, type GlobalProfile, type ProjectData } from '../../../src/core/storage/StorageSchema';
import type { ChallengeRecord } from '../../../src/core/questions/QuestionTypes';
import { updateRollingScore } from '../../../src/core/scoring/ScoreEngine';

const NOW = Date.parse('2026-09-13T12:00:00Z');

/** Only the fields the aggregation reads — the rest never leaves this file. */
function challengeAt(answeredAt: number, correct: boolean): ChallengeRecord {
  return {
    question: {
      id: `q${answeredAt}`,
      type: 'recall',
      category: 'recall',
      difficulty: 'medium',
      prompt: 'why',
      body: { kind: 'free-text', maxLength: 500 },
      provenance: { reason: 'because', sourceFiles: [] },
      isRetentionCheck: false,
      createdAt: answeredAt,
      generatedBy: 'ai',
    },
    answer: { questionId: `q${answeredAt}`, kind: 'free-text', text: 'a', answeredAt, timeTakenMs: 1000 },
    evaluation: { score: correct ? 1 : 0, correct, confidence: 1, strengths: [], gaps: [], feedback: 'ok' },
  } as unknown as ChallengeRecord;
}

function globalProfile(overrides: Partial<GlobalProfile> = {}): GlobalProfile {
  return {
    schemaVersion: 1,
    onboarded: true,
    settings: defaultSettings(),
    categoryScores: createDefaultRollingScores(),
    streak: { current: 2, longest: 5, lastActiveDate: '2026-09-13', daysActive: 9 },
    badges: [],
    auraHistory: [],
    challengesPausedUntil: null,
    aiPromptDismissed: false,
    ...overrides,
  };
}

function projectData(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    schemaVersion: 1,
    projectId: 'p1',
    projectName: 'codora',
    sessions: [],
    challenges: [],
    categoryScores: createDefaultRollingScores(),
    auraHistory: [],
    ...overrides,
  };
}

describe('buildDashboardState', () => {
  /**
   * The project view pairs a project-scoped aura with a per-category
   * breakdown. Feeding it the global breakdown made the bars disagree with
   * the number printed above them whenever the user works in more than one
   * workspace.
   */
  it('scopes the project breakdown to the project, not the global profile', () => {
    // Global is strong at recall; this workspace is weak at it.
    let globalScores = createDefaultRollingScores();
    globalScores = updateRollingScore(globalScores, 'recall', 1, NOW);
    globalScores = updateRollingScore(globalScores, 'reasoning', 1, NOW);
    globalScores = updateRollingScore(globalScores, 'debugging', 1, NOW);

    let projectScores = createDefaultRollingScores();
    projectScores = updateRollingScore(projectScores, 'recall', 0.2, NOW);

    const state = buildDashboardState(
      globalProfile({ categoryScores: globalScores }),
      projectData({ categoryScores: projectScores, challenges: [challengeAt(NOW, false)] }),
      NOW,
    );

    const projectRecall = state.project.breakdown.find((b) => b.category === 'recall');
    const globalRecall = state.breakdown.find((b) => b.category === 'recall');

    expect(projectRecall?.value).toBe(20);
    expect(globalRecall?.value).toBe(100);

    // The project breakdown must only describe categories this project scored.
    expect(state.project.breakdown.map((b) => b.category)).toEqual(['recall']);
  });

  it('keeps the project aura consistent with the bars shown beside it', () => {
    let projectScores = createDefaultRollingScores();
    projectScores = updateRollingScore(projectScores, 'recall', 0.5, NOW);
    projectScores = updateRollingScore(projectScores, 'testing', 0.5, NOW);

    const state = buildDashboardState(
      globalProfile(),
      projectData({ categoryScores: projectScores, challenges: [challengeAt(NOW, true)] }),
      NOW,
    );

    expect(state.project.aura).toBe(50);
    for (const bar of state.project.breakdown) expect(bar.value).toBe(50);
  });

  it('reports no project breakdown before the project has been scored', () => {
    const state = buildDashboardState(globalProfile(), projectData(), NOW);
    expect(state.project.breakdown).toEqual([]);
    expect(state.project.aura).toBeNull();
  });
});
