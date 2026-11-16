import type { ChallengeRecord } from './QuestionTypes';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Spaced review: after a correct answer about a piece of code, ask about
 * it again 7, then 21, then 60 days later; after a wrong answer, come back
 * in 3 days. This is what "retention" measures — whether you still
 * understand code you shipped weeks ago, not just code you touched today.
 */
export const REVIEW_INTERVALS_DAYS = [7, 21, 60] as const;
export const RELEARN_DAYS = 3;

export interface ReviewSubject {
  file: string;
  subjectFunction?: string;
  /** How far past due, as a multiple of its interval — most overdue reviews first. */
  overdue: number;
}

/** Subjects (file + function) whose next review is due at `now`, most overdue first. */
export function dueForReview(challenges: ChallengeRecord[], now: number): ReviewSubject[] {
  const bySubject = new Map<string, ChallengeRecord[]>();
  for (const record of challenges) {
    if (record.flagged) continue;
    const file = record.question.provenance.sourceFiles[0];
    if (!file) continue;
    const key = `${file}#${record.question.provenance.subjectFunction ?? ''}`;
    const list = bySubject.get(key) ?? [];
    list.push(record);
    bySubject.set(key, list);
  }

  const due: ReviewSubject[] = [];
  for (const records of bySubject.values()) {
    records.sort((a, b) => a.answer.answeredAt - b.answer.answeredAt);
    const last = records[records.length - 1];
    const interval = nextIntervalDays(records) * DAY_MS;
    const elapsed = now - last.answer.answeredAt;
    if (elapsed >= interval) {
      due.push({
        file: last.question.provenance.sourceFiles[0],
        subjectFunction: last.question.provenance.subjectFunction,
        overdue: elapsed / interval,
      });
    }
  }
  return due.sort((a, b) => b.overdue - a.overdue);
}

/** The gap before the next review: by the run of correct answers at the end, or the relearn gap after a miss. */
export function nextIntervalDays(records: ChallengeRecord[]): number {
  let streak = 0;
  for (let i = records.length - 1; i >= 0 && records[i].evaluation.correct; i--) streak++;
  if (streak === 0) return RELEARN_DAYS;
  return REVIEW_INTERVALS_DAYS[Math.min(streak, REVIEW_INTERVALS_DAYS.length) - 1];
}
