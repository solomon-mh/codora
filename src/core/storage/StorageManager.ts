import type * as vscode from 'vscode';
import {
  SCHEMA_VERSION,
  type GlobalProfile,
  type ProjectData,
  defaultSettings,
} from './StorageSchema';
import { createDefaultRollingScores } from '../scoring/ScoreTypes';
import { getLogger } from '../../utils/logger';

const GLOBAL_KEY = 'codora.globalProfile';
const PROJECT_KEY_PREFIX = 'codora.project.';

function defaultGlobalProfile(): GlobalProfile {
  return {
    schemaVersion: SCHEMA_VERSION,
    onboarded: false,
    settings: defaultSettings(),
    categoryScores: createDefaultRollingScores(),
    streak: { current: 0, longest: 0, lastActiveDate: null, daysActive: 0 },
    badges: [],
    auraHistory: [],
    challengesPausedUntil: null,
  };
}

function defaultProjectData(projectId: string, projectName: string): ProjectData {
  return {
    schemaVersion: SCHEMA_VERSION,
    projectId,
    projectName,
    sessions: [],
    challenges: [],
    categoryScores: createDefaultRollingScores(),
    auraHistory: [],
  };
}

/**
 * Thin, versioned wrapper around VS Code's global/workspace state. Recovers
 * from corrupted stored data by logging a warning and falling back to a
 * fresh default rather than crashing the extension (spec section 45).
 */
export class StorageManager {
  private projectId: string;

  constructor(
    private readonly context: vscode.ExtensionContext,
    projectId: string,
    private readonly projectName: string,
  ) {
    this.projectId = projectId;
  }

  private projectKey(): string {
    return `${PROJECT_KEY_PREFIX}${this.projectId}`;
  }

  getGlobalProfile(): GlobalProfile {
    const raw = this.context.globalState.get<GlobalProfile>(GLOBAL_KEY);
    return this.validateGlobal(raw);
  }

  async updateGlobalProfile(updater: (profile: GlobalProfile) => GlobalProfile): Promise<GlobalProfile> {
    const current = this.getGlobalProfile();
    const next = updater(current);
    await this.context.globalState.update(GLOBAL_KEY, next);
    return next;
  }

  getProjectData(): ProjectData {
    const raw = this.context.workspaceState.get<ProjectData>(this.projectKey());
    return this.validateProject(raw);
  }

  async updateProjectData(updater: (data: ProjectData) => ProjectData): Promise<ProjectData> {
    const current = this.getProjectData();
    const next = updater(current);
    await this.context.workspaceState.update(this.projectKey(), next);
    return next;
  }

  async resetProjectData(): Promise<void> {
    await this.context.workspaceState.update(this.projectKey(), undefined);
  }

  private validateGlobal(raw: GlobalProfile | undefined): GlobalProfile {
    if (!raw || typeof raw !== 'object') {
      return defaultGlobalProfile();
    }
    try {
      const migrated = this.migrateGlobal(raw);
      // Shallow structural sanity check.
      if (!migrated.settings || !migrated.categoryScores || !migrated.streak) {
        throw new Error('missing required fields');
      }
      return migrated;
    } catch (err) {
      getLogger().warn('Corrupted global profile, resetting to defaults', {
        error: String(err),
      });
      return defaultGlobalProfile();
    }
  }

  private validateProject(raw: ProjectData | undefined): ProjectData {
    if (!raw || typeof raw !== 'object') {
      return defaultProjectData(this.projectId, this.projectName);
    }
    try {
      const migrated = this.migrateProject(raw);
      if (!Array.isArray(migrated.sessions) || !Array.isArray(migrated.challenges)) {
        throw new Error('missing required fields');
      }
      return migrated;
    } catch (err) {
      getLogger().warn('Corrupted project data, resetting to defaults', {
        projectId: this.projectId,
        error: String(err),
      });
      return defaultProjectData(this.projectId, this.projectName);
    }
  }

  /** Schema migration hook. No prior versions exist yet, so this is currently a passthrough. */
  private migrateGlobal(raw: GlobalProfile): GlobalProfile {
    if (raw.schemaVersion === SCHEMA_VERSION) return raw;
    return { ...defaultGlobalProfile(), ...raw, schemaVersion: SCHEMA_VERSION };
  }

  private migrateProject(raw: ProjectData): ProjectData {
    if (raw.schemaVersion === SCHEMA_VERSION) return raw;
    return {
      ...defaultProjectData(this.projectId, this.projectName),
      ...raw,
      schemaVersion: SCHEMA_VERSION,
    };
  }
}
