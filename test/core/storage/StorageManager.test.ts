import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager } from '../../../src/core/storage/StorageManager';
import { defaultSettings } from '../../../src/core/storage/StorageSchema';
import { initLogger } from '../../../src/utils/logger';

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
