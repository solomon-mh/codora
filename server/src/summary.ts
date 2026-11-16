import type { D1Database } from './d1';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The numbers that say whether Codora works, over the last `days`:
 * do people answer questions or dismiss them, how often is a question
 * reported or thrown out by the answer-key check, and do people come back.
 */
export async function buildSummary(db: D1Database, now: number, days: number) {
  const since = now - days * DAY_MS;

  const counts = await db
    .prepare(
      `SELECT name, COUNT(*) AS n, COUNT(DISTINCT install_id) AS installs
       FROM events WHERE at >= ? GROUP BY name`,
    )
    .bind(since)
    .all<{ name: string; n: number; installs: number }>();
  const count = (name: string) => counts.results.find((r) => r.name === name)?.n ?? 0;

  const installs = await db
    .prepare('SELECT COUNT(DISTINCT install_id) AS n FROM events WHERE at >= ?')
    .bind(since)
    .first<{ n: number }>();
  const active7 = await db
    .prepare('SELECT COUNT(DISTINCT install_id) AS n FROM events WHERE at >= ?')
    .bind(now - 7 * DAY_MS)
    .first<{ n: number }>();

  const correct = await db
    .prepare(`SELECT COUNT(*) AS n FROM events WHERE name = 'answered' AND at >= ? AND json_extract(props, '$.correct') = 1`)
    .bind(since)
    .first<{ n: number }>();
  const flaggedAnswered = await db
    .prepare(`SELECT COUNT(*) AS n FROM events WHERE name = 'flagged' AND at >= ? AND json_extract(props, '$.answered') = 1`)
    .bind(since)
    .first<{ n: number }>();

  // Week-1 retention: of installs first seen 7–37 days ago, the share seen
  // again on days 7–13 after their first event.
  const retention = await db
    .prepare(
      `WITH first AS (
         SELECT install_id, MIN(at) AS first_at FROM events GROUP BY install_id
       ), cohort AS (
         SELECT * FROM first WHERE first_at <= ? AND first_at > ?
       )
       SELECT COUNT(*) AS cohort,
              SUM(EXISTS (
                SELECT 1 FROM events e
                WHERE e.install_id = cohort.install_id
                  AND e.at >= cohort.first_at + ? AND e.at < cohort.first_at + ?
              )) AS returned
       FROM cohort`,
    )
    .bind(now - 7 * DAY_MS, now - 37 * DAY_MS, 7 * DAY_MS, 14 * DAY_MS)
    .first<{ cohort: number; returned: number | null }>();

  const shown = count('question_shown');
  const answered = count('answered');
  const rejected = count('question_rejected');
  const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);

  return {
    windowDays: days,
    installs: installs?.n ?? 0,
    activeLast7Days: active7?.n ?? 0,
    questions: {
      shown,
      answered,
      abandoned: count('abandoned'),
      reported: count('flagged'),
      reportedAfterAnswering: flaggedAnswered?.n ?? 0,
      rejectedByAnswerKeyCheck: rejected,
      noQuestionAvailable: count('no_question'),
    },
    ratesPct: {
      answeredOfShown: rate(answered, shown),
      abandonedOfShown: rate(count('abandoned'), shown),
      reportedOfShown: rate(count('flagged'), shown),
      rejectedOfGenerated: rate(rejected, shown + rejected),
      correctOfAnswered: rate(correct?.n ?? 0, answered),
    },
    week1Retention: {
      cohort: retention?.cohort ?? 0,
      returned: retention?.returned ?? 0,
      pct: rate(retention?.returned ?? 0, retention?.cohort ?? 0),
    },
  };
}
