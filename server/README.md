# Codora usage counts

A small Cloudflare Worker that receives Codora's **opt-in, anonymous** usage
counts and answers one question: does Codora work? That means: do people
answer the questions or dismiss them, how often is a question reported or
thrown out by the answer-key check, and do people come back after a week.

## What is stored

Only what [`src/validate.ts`](src/validate.ts) allows: an event name, a
timestamp, and a few enum, boolean or bucketed-number fields per event. The
same list is the client's contract in
[`src/core/metrics/Metrics.ts`](../src/core/metrics/Metrics.ts). No code,
file or function names, questions, answers, IP addresses or user agents.
The install id is a random UUID created when someone opts in and deleted
when they opt out.

## Deploy (about 5 minutes, free tier)

```bash
cd server
npm install
npx wrangler login
npx wrangler d1 create codora-metrics      # copy the printed database_id
# paste it into wrangler.toml, replacing REPLACE_WITH_D1_DATABASE_ID
npm run migrate                            # creates the events table
npx wrangler secret put SUMMARY_TOKEN      # any long random string; keep it
npm run deploy                             # prints https://codora-metrics.<you>.workers.dev
```

Then point the extension at it: set `METRICS_ENDPOINT` in
[`src/core/metrics/Metrics.ts`](../src/core/metrics/Metrics.ts) to the
printed URL, with no trailing slash, and release a new version. Until that
constant is set, the extension sends nothing.

## Read the numbers

```bash
curl -H "Authorization: Bearer $SUMMARY_TOKEN" \
  "https://codora-metrics.<you>.workers.dev/v1/summary?days=30"
```

Returns installs, weekly actives, questions shown, answered, abandoned,
reported and rejected by the answer-key check, the rates between them, and
week-1 retention.
