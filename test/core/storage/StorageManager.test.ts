import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager } from '../../../src/core/storage/StorageManager';
import { defaultSettings } from '../../../src/core/storage/StorageSchema';
import { initLogger } from '../../../src/utils/logger';
import { replayRollingScores } from '../../../src/core/scoring/ScoreEngine';
import { createDefaultRollingScores } from '../../../src/core/scoring/ScoreTypes';
import type { ChallengeRecord } from '../../../src/core/questions/QuestionTypes';

initLogger({ appendLine: () => {} });

class FakeMemento {
  private store = new Map<string, unknown>();
  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }
  async update(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }
}

function fakeContext() {
  return {
    globalState: new FakeMemento(),
    workspaceState: new FakeMemento(),
  } as unknown as import('vscode').ExtensionContext;
}

describe('StorageManager', () => {
  let context: ReturnType<typeof fakeContext>;

  beforeEach(() => {
    context = fakeContext();
  });

  it('returns default global profile when nothing is stored', () => {
    const storage = new StorageManager(context, 'proj1', 'my-project');
    const profile = storage.getGlobalProfile();
    expect(profile.onboarded).toBe(false);
    expect(profile.streak.current).toBe(0);
  });

  it('round-trips an updated global profile', async () => {
    const storage = new StorageManager(context, 'proj1', 'my-project');
    await storage.updateGlobalProfile((p) => ({ ...p, onboarded: true }));
    expect(storage.getGlobalProfile().onboarded).toBe(true);
  });

  it('scopes project data by projectId', async () => {
    const storage1 = new StorageManager(context, 'proj1', 'project-one');
    const storage2 = new StorageManager(context, 'proj2', 'project-two');
    await storage1.updateProjectData((p) => ({ ...p, projectName: 'renamed-one' }));
    expect(storage1.getProjectData().projectName).toBe('renamed-one');
    expect(storage2.getProjectData().projectName).toBe('project-two');
  });

  it('recovers from corrupted global state instead of throwing', () => {
    context.globalState.update('codora.globalProfile', { not: 'a valid profile' });
    const storage = new StorageManager(context, 'proj1', 'my-project');
    const profile = storage.getGlobalProfile();
    expect(profile.settings).toBeDefined();
    expect(profile.streak.current).toBe(0);
  });

  it('resets project data back to defaults', async () => {
    const storage = new StorageManager(context, 'proj1', 'my-project');
    await storage.updateProjectData((p) => ({ ...p, projectName: 'changed' }));
    await storage.resetProjectData();
    expect(storage.getProjectData().projectName).toBe('my-project');
  });

  it('fills in AI settings missing from a profile stored before they existed', () => {
    const storage = new StorageManager(context, 'proj1', 'my-project');
    // A profile whose `settings` predates the `ai` block entirely.
    context.globalState.update('codora.globalProfile', {
      ...storage.getGlobalProfile(),
      settings: { ...defaultSettings(), ai: undefined },
    });
    const ai = storage.getGlobalProfile().settings.ai;
    expect(ai.enabled).toBe(true);
    expect(ai.geminiModel).toBe(defaultSettings().ai.geminiModel);
  });

  it('replaces a retired model id with the current default instead of keeping it forever', () => {
    const storage = new StorageManager(context, 'proj1', 'my-project');
    const profile = storage.getGlobalProfile();
    context.globalState.update('codora.globalProfile', {
      ...profile,
      settings: {
        ...profile.settings,
        // A model id that was valid when it was stored but has since been retired.
        ai: { ...profile.settings.ai, geminiModel: 'gemini-2.5-flash' },
      },
    });

    expect(storage.getGlobalProfile().settings.ai.geminiModel).toBe(defaultSettings().ai.geminiModel);
  });

  it('keeps a stored model id that is still supported', () => {
    const storage = new StorageManager(context, 'proj1', 'my-project');
    const profile = storage.getGlobalProfile();
    context.globalState.update('codora.globalProfile', {
      ...profile,
      settings: { ...profile.settings, ai: { ...profile.settings.ai, anthropicModel: 'claude-opus-5' } },
    });

    expect(storage.getGlobalProfile().settings.ai.anthropicModel).toBe('claude-opus-5');
  });
});

/** A stored answer, as kept in a project's challenge history. */
function answered(type: 'recall' | 'debugging', correct: boolean, answeredAt: number): ChallengeRecord {
  return {
    question: { id: `q${answeredAt}`, type },
    answer: { questionId: `q${answeredAt}`, kind: 'multiple-choice', answeredAt, timeTakenMs: 1000 },
    evaluation: { score: correct ? 1 : 0, correct, confidence: 1, strengths: [], gaps: [], feedback: '' },
  } as unknown as ChallengeRecord;
}

describe('StorageManager migration to neutral-start scoring (schema 2)', () => {
  it('replays a project’s stored answers under the new rule', async () => {
    const context = fakeContext();
    const challenges = [answered('recall', true, 1), answered('debugging', false, 2), answered('debugging', false, 3)];
    await context.workspaceState.update('codora.project.proj1', {
      schemaVersion: 1,
      projectId: 'proj1',
      projectName: 'p',
      sessions: [],
      challenges,
      // Old rule: seeded with the first result.
      categoryScores: { ...createDefaultRollingScores(), recall: { value: 100, sampleCount: 1, lastUpdated: 1 }, debugging: { value: 0, sampleCount: 2, lastUpdated: 3 } },
      auraHistory: [],
    });

    const project = new StorageManager(context, 'proj1', 'p').getProjectData();

    expect(project.schemaVersion).toBe(2);
    expect(project.categoryScores).toEqual(replayRollingScores(challenges));
    expect(project.categoryScores.recall.value).toBe(62.5);
    expect(project.categoryScores.debugging.value).toBeCloseTo(28.125);
  });

  it('rebases global scores onto the neutral start, exactly when a category was all right or all wrong', async () => {
    const context = fakeContext();
    await context.globalState.update('codora.globalProfile', {
      schemaVersion: 1,
      onboarded: true,
      settings: defaultSettings(),
      categoryScores: { ...createDefaultRollingScores(), recall: { value: 100, sampleCount: 1, lastUpdated: 1 }, debugging: { value: 0, sampleCount: 2, lastUpdated: 3 } },
      streak: { current: 0, longest: 0, lastActiveDate: null, daysActive: 0 },
      badges: [],
      auraHistory: [],
      challengesPausedUntil: null,
      aiPromptDismissed: false,
    });

    const global = new StorageManager(context, 'proj1', 'p').getGlobalProfile();
    const replayed = replayRollingScores([answered('recall', true, 1), answered('debugging', false, 2), answered('debugging', false, 3)]);

    expect(global.schemaVersion).toBe(2);
    expect(global.categoryScores.recall.value).toBeCloseTo(replayed.recall.value);
    expect(global.categoryScores.debugging.value).toBeCloseTo(replayed.debugging.value);
    expect(global.categoryScores.reasoning.sampleCount).toBe(0);
  });
});
