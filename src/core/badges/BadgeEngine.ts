import type { ChallengeRecord } from '../questions/QuestionTypes';
import type { BadgeState, GlobalProfile } from '../storage/StorageSchema';

export type BadgeId =
  | 'first-step'
  | 'code-defender'
  | 'deep-thinker'
  | 'bug-hunter'
  | 'architect'
  | 'streak-7'
  | 'streak-30'
  | 'rising-aura';

export const BADGE_LABELS: Record<BadgeId, string> = {
  'first-step': 'First Step',
  'code-defender': 'Code Defender',
  'deep-thinker': 'Deep Thinker',
  'bug-hunter': 'Bug Hunter',
  architect: 'Architect',
  'streak-7': '7 Day Streak',
  'streak-30': '30 Day Streak',
  'rising-aura': 'Rising Aura',
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Evaluates real, stored history against the section-25 badge conditions.
 * Never invents progress — every condition is computed from
 * `allChallenges`/`profile`, so a badge only appears once it is actually
 * earned.
 */
export function evaluateBadges(
  profile: GlobalProfile,
  allChallenges: ChallengeRecord[],
  now: number,
): BadgeState[] {
  const earned = new Set(profile.badges.map((b) => b.id));
  const newlyEarned: BadgeState[] = [];

  const correctByCategory = (category: string) =>
    allChallenges.filter((c) => c.question.category === category && c.evaluation.correct).length;

  const checks: Array<[BadgeId, boolean]> = [
    ['first-step', allChallenges.length >= 1],
    ['code-defender', allChallenges.length >= 10],
    ['deep-thinker', correctByCategory('reasoning') >= 10],
    ['bug-hunter', correctByCategory('debugging') >= 10],
    ['architect', allChallenges.filter((c) => c.question.category === 'architecture').length >= 10],
    ['streak-7', profile.streak.longest >= 7],
    ['streak-30', profile.streak.longest >= 30],
    ['rising-aura', hasRisingAura(profile, now)],
  ];

  for (const [id, condition] of checks) {
    if (condition && !earned.has(id)) {
      newlyEarned.push({ id, earnedAt: now });
    }
  }

  return newlyEarned;
}

function hasRisingAura(profile: GlobalProfile, now: number): boolean {
  const cutoff = now - THIRTY_DAYS_MS;
  const recentHistory = profile.auraHistory.filter((h) => Date.parse(h.date) >= cutoff);
  if (recentHistory.length < 2) return false;
  const earliest = recentHistory[0].value;
  const latest = recentHistory[recentHistory.length - 1].value;
  return latest - earliest >= 15;
}
