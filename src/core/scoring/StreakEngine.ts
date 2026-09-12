import type { StreakState } from '../storage/StorageSchema';

function toIsoDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(b) - Date.parse(a)) / msPerDay);
}

/**
 * Streaks are earned by completing at least one challenge on a day (spec
 * section 24) — not merely opening VS Code.
 */
export function recordChallengeCompletion(streak: StreakState, now: number): StreakState {
  const today = toIsoDate(now);

  if (streak.lastActiveDate === today) {
    return streak;
  }

  const isConsecutive = streak.lastActiveDate !== null && daysBetween(streak.lastActiveDate, today) === 1;
  const current = isConsecutive ? streak.current + 1 : 1;

  return {
    current,
    longest: Math.max(streak.longest, current),
    lastActiveDate: today,
    daysActive: streak.daysActive + 1,
  };
}

/** Call periodically to reset a streak that has gone cold (missed a day). */
export function applyStreakDecay(streak: StreakState, now: number): StreakState {
  if (!streak.lastActiveDate) return streak;
  const today = toIsoDate(now);
  if (daysBetween(streak.lastActiveDate, today) > 1) {
    return { ...streak, current: 0 };
  }
  return streak;
}
