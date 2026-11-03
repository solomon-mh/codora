import { AURA_TIERS } from '../../src/core/scoring/ScoreEngine';

export type Tone = 'good' | 'warning' | 'high' | 'critical';

export interface AuraTier {
  label: string;
  /** The next tier up, or undefined at the top. */
  next?: string;
  /** Whole points still needed to reach the next tier. */
  pointsToNext?: number;
}

/** Where a score sits on the tier ladder, read from the same table the scorer uses. */
export function auraTier(value: number): AuraTier {
  const clamped = Math.max(0, Math.min(100, value));
  const index = AURA_TIERS.reduce((found, tier, i) => (clamped >= tier.min ? i : found), 0);
  const next = AURA_TIERS[index + 1];
  return {
    label: AURA_TIERS[index].label,
    next: next?.label,
    pointsToNext: next ? Math.max(1, Math.ceil(next.min - clamped)) : undefined,
  };
}

export function nextTierText(tier: AuraTier): string {
  if (!tier.next) return 'Top tier.';
  return `${tier.pointsToNext} ${tier.pointsToNext === 1 ? 'point' : 'points'} to ${tier.next}`;
}

/** The scale's boundaries and named bands, from the tier table. */
export const AURA_BOUNDARIES = AURA_TIERS.slice(1).map((t) => t.min);
export const AURA_BANDS = AURA_TIERS.map((t, i) => ({
  from: t.min,
  to: AURA_TIERS[i + 1]?.min ?? 100,
  label: t.label,
}));

/** A score's verdict as an evidence tone. 70+ is healthy; below 40 is broken. */
export function scoreTone(value: number): Tone {
  if (value >= 70) return 'good';
  if (value >= 60) return 'warning';
  if (value >= 40) return 'high';
  return 'critical';
}
