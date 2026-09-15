import { computeAura, auraLabel } from '../scoring/ScoreEngine';
import { SCORE_CATEGORIES, type ScoreCategory } from '../scoring/ScoreTypes';
import type { GlobalProfile, ProjectData } from '../storage/StorageSchema';
import { BADGE_LABELS, type BadgeId } from '../badges/BadgeEngine';
import type {
  BadgeItem,
  CategoryBreakdownItem,
  DashboardState,
  HistoryItem,
  SidebarState,
} from '../../../webview/shared/messages';

const MIN_CHALLENGES_FOR_AURA = 3;
const MIN_SAMPLES_FOR_INSIGHT = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function totalSamples(profile: GlobalProfile): number {
  return SCORE_CATEGORIES.reduce((sum, c) => sum + profile.categoryScores[c].sampleCount, 0);
}

function label(category: ScoreCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function buildBreakdown(scores: GlobalProfile['categoryScores']): CategoryBreakdownItem[] {
  return SCORE_CATEGORIES.filter((c) => scores[c].sampleCount > 0).map((c) => ({
    category: c,
    label: label(c),
    value: scores[c].value,
    sampleCount: scores[c].sampleCount,
  }));
}

export function buildSidebarState(global: GlobalProfile, project: ProjectData): SidebarState {
  const hasEnoughData = totalSamples(global) >= MIN_CHALLENGES_FOR_AURA;
  const aura = hasEnoughData ? computeAura(global.categoryScores) : null;

  return {
    hasEnoughData,
    aura,
    auraLabel: aura !== null ? auraLabel(aura) : '',
    streakCurrent: global.streak.current,
    projectName: project.projectName,
    breakdown: buildBreakdown(global.categoryScores).slice(0, 5),
    challengesPaused: global.challengesPausedUntil !== null && global.challengesPausedUntil > Date.now(),
    insightHint: 'Keep answering challenges to unlock your progress breakdown.',
  };
}

/**
 * Everything except `aiStatus`, which requires an async check (secret
 * storage / vscode.lm) that doesn't belong in this otherwise-pure
 * aggregation function — the caller (DashboardProvider) fills it in.
 */
export function buildDashboardState(
  global: GlobalProfile,
  project: ProjectData,
  now: number,
): Omit<DashboardState, 'aiStatus'> {
  const hasEnoughData = totalSamples(global) >= MIN_CHALLENGES_FOR_AURA;
  const globalAura = hasEnoughData ? computeAura(global.categoryScores) : null;
  const projectHasData = project.challenges.length > 0;
  const projectAura = projectHasData ? computeAura(project.categoryScores) : null;

  const weekAgo = now - WEEK_MS;
  const auraWeekAgoEntry = [...global.auraHistory].reverse().find((h) => Date.parse(h.date) <= weekAgo);
  const auraDeltaThisWeek =
    globalAura !== null && auraWeekAgoEntry
      ? ((globalAura - auraWeekAgoEntry.value) / Math.max(1, auraWeekAgoEntry.value)) * 100
      : null;

  const recentSessions = project.sessions.filter((s) => s.startedAt >= weekAgo);
  const recentChallenges = project.challenges.filter((c) => c.answer.answeredAt >= weekAgo);
  const correctCount = recentChallenges.filter((c) => c.evaluation.correct).length;

  return {
    hasEnoughData,
    globalAura,
    projectAura,
    auraLabel: globalAura !== null ? auraLabel(globalAura) : '',
    auraDeltaThisWeek,
    breakdown: buildBreakdown(global.categoryScores),
    thisWeek: {
      codingSessions: recentSessions.length,
      challengesCompleted: recentChallenges.length,
      correctAnswers: correctCount,
      accuracyPct: recentChallenges.length > 0 ? Math.round((correctCount / recentChallenges.length) * 100) : null,
      currentStreak: global.streak.current,
      bestStreak: global.streak.longest,
      dailyChallengeCounts: buildDailyChallengeCounts(project.challenges, now),
    },
    insights: buildInsights(global, projectAura, now),
    project: {
      name: project.projectName,
      aura: projectAura,
      challenges: project.challenges.length,
      breakdown: buildBreakdown(project.categoryScores),
      strongCategories: SCORE_CATEGORIES.filter(
        (c) => project.categoryScores[c].sampleCount >= MIN_SAMPLES_FOR_INSIGHT && project.categoryScores[c].value >= 80,
      ),
      weakCategories: SCORE_CATEGORIES.filter(
        (c) => project.categoryScores[c].sampleCount >= MIN_SAMPLES_FOR_INSIGHT && project.categoryScores[c].value < 60,
      ),
    },
    history: buildHistory(project, now),
    badges: buildBadges(global.badges),
    settings: global.settings,
  };
}

function buildDailyChallengeCounts(challenges: ProjectData['challenges'], now: number): { day: string; count: number }[] {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const startOfWeek = new Date(now);
  const dayIndex = (startOfWeek.getDay() + 6) % 7; // Monday = 0
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setTime(startOfWeek.getTime() - dayIndex * 24 * 60 * 60 * 1000);

  const counts = new Array(7).fill(0);
  for (const c of challenges) {
    const diffDays = Math.floor((c.answer.answeredAt - startOfWeek.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays >= 0 && diffDays < 7) counts[diffDays]++;
  }

  return labels.map((day, i) => ({ day, count: counts[i] }));
}

function buildInsights(global: GlobalProfile, projectAura: number | null, now: number): string[] {
  const insights: string[] = [];
  const scored = SCORE_CATEGORIES.filter((c) => global.categoryScores[c].sampleCount >= MIN_SAMPLES_FOR_INSIGHT);
  if (scored.length === 0) return insights;

  const strongest = scored.reduce((a, b) => (global.categoryScores[a].value >= global.categoryScores[b].value ? a : b));
  insights.push(`You are strongest at ${label(strongest).toLowerCase()}.`);

  const weakest = scored.reduce((a, b) => (global.categoryScores[a].value <= global.categoryScores[b].value ? a : b));
  if (weakest !== strongest && global.categoryScores[weakest].value < 60) {
    insights.push(`You frequently struggle with ${label(weakest).toLowerCase()}.`);
  }

  const weekAgo = now - WEEK_MS;
  const priorEntry = [...global.auraHistory].reverse().find((h) => Date.parse(h.date) <= weekAgo);
  const currentAura = computeAura(global.categoryScores);
  if (priorEntry && currentAura - priorEntry.value >= 5) {
    insights.push(`Your aura improved ${Math.round(currentAura - priorEntry.value)} points this week.`);
  }

  void projectAura;
  return insights;
}

function buildHistory(project: ProjectData, now: number): HistoryItem[] {
  return [...project.challenges]
    .sort((a, b) => b.answer.answeredAt - a.answer.answeredAt)
    .slice(0, 50)
    .map((c) => ({
      questionId: c.question.id,
      correct: c.evaluation.correct,
      category: c.question.category,
      difficulty: c.question.difficulty,
      timestampLabel: relativeDay(c.answer.answeredAt, now),
      prompt: c.question.prompt,
      scorePct: c.evaluation.score * 100,
      sourceFiles: c.question.provenance.sourceFiles,
      answerText: c.answer.text,
      feedback: c.evaluation.feedback,
      strengths: c.evaluation.strengths,
      gaps: c.evaluation.gaps,
      generatedBy: c.question.generatedBy ?? 'deterministic',
      generator: c.question.generator,
    }));
}

function buildBadges(earned: GlobalProfile['badges']): BadgeItem[] {
  const earnedMap = new Map(earned.map((b) => [b.id, b.earnedAt]));
  return (Object.keys(BADGE_LABELS) as BadgeId[]).map((id) => ({
    id,
    label: BADGE_LABELS[id],
    earned: earnedMap.has(id),
    earnedAt: earnedMap.get(id),
  }));
}

function relativeDay(timestamp: number, now: number): string {
  const diffDays = Math.floor((now - timestamp) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return new Date(timestamp).toLocaleDateString();
}
