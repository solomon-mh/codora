import type { CodoraSettings } from '../storage/StorageSchema';

/** Adaptive is a real but deliberately simple first pass (spec section 10/13/31). */
export const ADAPTIVE_DEFAULT_MS = 25 * 60_000;
const MIN_CUSTOM_MINUTES = 1;

/**
 * Resolves the configured challenge interval to a concrete millisecond
 * value, or null for "off" (never fire). Kept pure/vscode-free — unlike
 * SessionManager.ts, which genuinely needs the real vscode APIs and can't
 * be loaded outside the extension host — so this mapping is unit-testable.
 */
export function resolveIntervalMs(settings: CodoraSettings): number | null {
  switch (settings.challengeInterval) {
    case '10min':
      return 10 * 60_000;
    case '30min':
      return 30 * 60_000;
    case '1hour':
      return 60 * 60_000;
    case 'custom':
      return Math.max(MIN_CUSTOM_MINUTES, settings.customIntervalMinutes) * 60_000;
    case 'adaptive':
      return ADAPTIVE_DEFAULT_MS;
    case 'off':
      return null;
  }
}
