import { describe, it, expect } from 'vitest';
import { evaluateBadges } from '../../../src/core/badges/BadgeEngine';
import { createDefaultRollingScores } from '../../../src/core/scoring/ScoreTypes';
import type { GlobalProfile } from '../../../src/core/storage/StorageSchema';
import { defaultSettings } from '../../../src/core/storage/StorageSchema';
import type { ChallengeRecord } from '../../../src/core/questions/QuestionTypes';

function baseProfile(overrides: Partial<GlobalProfile> = {}): GlobalProfile {
  return {
    schemaVersion: 1,
    onboarded: true,
    settings: defaultSettings(),
    categoryScores: createDefaultRollingScores(),
    streak: { current: 0, longest: 0, lastActiveDate: null, daysActive: 0 },
    badges: [],
    auraHistory: [],
    challengesPausedUntil: null,
    ...overrides,
  };
}

function challenge(category: string, correct: boolean): ChallengeRecord {
  return {
    question: {
      id: Math.random().toString(),
      type: 'recall',
      category: category as ChallengeRecord['question']['category'],
      difficulty: 'easy',
      prompt: 'x',
      body: { kind: 'multiple-choice', options: [{ id: 'a', text: 'x' }], correctOptionId: 'a' },
      provenance: { sourceFiles: [], sourceType: 'git-diff', reason: 'x' },
      isRetentionCheck: false,
      createdAt: 0,
    },
    answer: { questionId: 'x', kind: 'multiple-choice', selectedOptionId: 'a', answeredAt: 0, timeTakenMs: 0 },
    evaluation: { score: correct ? 1 : 0, correct, confidence: 1, strengths: [], gaps: [], feedback: '' },
  };
}

describe('evaluateBadges', () => {
  it('awards First Step after the first challenge', () => {
    const profile = baseProfile();
    const badges = evaluateBadges(profile, [challenge('recall', true)], Date.now());
    expect(badges.map((b) => b.id)).toContain('first-step');
  });

  it('does not re-award a badge already earned', () => {
    const profile = baseProfile({ badges: [{ id: 'first-step', earnedAt: 0 }] });
    const badges = evaluateBadges(profile, [challenge('recall', true)], Date.now());
    expect(badges.map((b) => b.id)).not.toContain('first-step');
  });

  it('awards Code Defender at 10 total challenges', () => {
    const profile = baseProfile();
    const challenges = Array.from({ length: 10 }, () => challenge('recall', true));
    const badges = evaluateBadges(profile, challenges, Date.now());
    expect(badges.map((b) => b.id)).toContain('code-defender');
  });

  it('awards Bug Hunter only once 10 debugging questions are answered correctly', () => {
    const profile = baseProfile();
    const nineCorrect = Array.from({ length: 9 }, () => challenge('debugging', true));
    expect(evaluateBadges(profile, nineCorrect, Date.now()).map((b) => b.id)).not.toContain('bug-hunter');

    const tenCorrect = Array.from({ length: 10 }, () => challenge('debugging', true));
    expect(evaluateBadges(profile, tenCorrect, Date.now()).map((b) => b.id)).toContain('bug-hunter');
  });

  it('awards streak badges based on the longest streak', () => {
    const profile = baseProfile({ streak: { current: 7, longest: 7, lastActiveDate: '2026-01-01', daysActive: 7 } });
    const badges = evaluateBadges(profile, [], Date.now());
    expect(badges.map((b) => b.id)).toContain('streak-7');
    expect(badges.map((b) => b.id)).not.toContain('streak-30');
  });
});
