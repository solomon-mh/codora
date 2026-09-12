import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager } from '../../../src/core/storage/StorageManager';
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
});
