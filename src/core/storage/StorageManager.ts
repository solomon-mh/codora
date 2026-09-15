import type * as vscode from 'vscode';
import {
  SCHEMA_VERSION,
  VALID_ANTHROPIC_MODELS,
  VALID_GEMINI_MODELS,
  VALID_OPENAI_MODELS,
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
    aiPromptDismissed: false,
  };
}

/**
 * Logged-once set: the profile is read many times per challenge, and
 * warning on every read buried the rest of the log in duplicates.
 */
const warnedRetiredModels = new Set<string>();

/** Keeps a stored model id only if it's still one the extension supports, else falls back to the current default. */
function validModel<T extends string>(stored: T, valid: readonly T[], fallback: T): T {
  if (valid.includes(stored)) return stored;
  if (!warnedRetiredModels.has(stored)) {
    warnedRetiredModels.add(stored);
    getLogger().warn('Stored model id is no longer supported, falling back to the default', {
      stored,
      fallback,
    });
  }
  return fallback;
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
      // Deep-merge settings against current defaults regardless of
      // schemaVersion: fields get added to CodoraSettings during active
      // development more often than SCHEMA_VERSION gets bumped, and a
      // profile stored before such an addition would otherwise be missing
      // a nested object (e.g. `settings.ai`) that later code assumes exists.
      const defaults = defaultSettings();
      const storedAi = { ...defaults.ai, ...migrated.settings.ai };
      return {
        ...migrated,
        aiPromptDismissed: migrated.aiPromptDismissed ?? false,
        settings: {
          ...defaults,
          ...migrated.settings,
          notifications: { ...defaults.notifications, ...migrated.settings.notifications },
          avoidInterrupting: { ...defaults.avoidInterrupting, ...migrated.settings.avoidInterrupting },
          ai: {
            ...storedAi,
            // Providers retire model ids; a retired id persisted here would
            // otherwise keep failing forever with no way to self-heal.
            anthropicModel: validModel(storedAi.anthropicModel, VALID_ANTHROPIC_MODELS, defaults.ai.anthropicModel),
            openAIModel: validModel(storedAi.openAIModel, VALID_OPENAI_MODELS, defaults.ai.openAIModel),
            geminiModel: validModel(storedAi.geminiModel, VALID_GEMINI_MODELS, defaults.ai.geminiModel),
          },
        },
      };
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
