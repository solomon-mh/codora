import { cleanBatch } from './validate';
import { buildSummary } from './summary';
import type { D1Database } from './d1';

export interface Env {
  DB: D1Database;
  /** Bearer token for GET /v1/summary. Set with `wrangler secret put SUMMARY_TOKEN`. */
  SUMMARY_TOKEN?: string;
}

const MAX_BODY_BYTES = 32 * 1024;
/** Per install per day; far above any real use, low enough to stop a runaway client filling the database. */
const MAX_EVENTS_PER_INSTALL_PER_DAY = 2000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Codora's usage-count endpoint.
 *
 *   POST /v1/events   a batch from an opted-in extension (see validate.ts)
 *   GET  /v1/summary  aggregate numbers, behind SUMMARY_TOKEN
 *   GET  /health
 *
 * Stores no IP address, user agent or anything else from the request
 * beyond the cleaned batch itself.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/v1/events') return await ingest(request, env);
      if (request.method === 'GET' && url.pathname === '/v1/summary') return await summary(request, env, url);
      if (request.method === 'GET' && url.pathname === '/health') return new Response('ok');
      return new Response('Not found', { status: 404 });
    } catch (err) {
      console.error('request failed', err instanceof Error ? err.message : String(err));
      return new Response('Internal error', { status: 500 });
    }
  },
};

async function ingest(request: Request, env: Env): Promise<Response> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return new Response('Too large', { status: 413 });
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new Response('Too large', { status: 413 });

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const now = Date.now();
  const batch = cleanBatch(raw, now);
  if (!batch) return new Response('Invalid batch', { status: 400 });
  if (batch.events.length === 0) return new Response(null, { status: 204 });

  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM events WHERE install_id = ? AND received_at > ?')
    .bind(batch.installId, now - DAY_MS)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) + batch.events.length > MAX_EVENTS_PER_INSTALL_PER_DAY) {
    return new Response('Rate limited', { status: 429 });
  }

  const insert = env.DB.prepare(
    'INSERT INTO events (install_id, name, props, at, received_at, extension_version, vscode_version, platform) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  await env.DB.batch(
    batch.events.map((e) =>
      insert.bind(batch.installId, e.name, JSON.stringify(e.props), e.at, now, batch.extensionVersion, batch.vscodeVersion, batch.platform),
    ),
  );
  return new Response(null, { status: 204 });
}

async function summary(request: Request, env: Env, url: URL): Promise<Response> {
  const token = env.SUMMARY_TOKEN;
  if (!token || request.headers.get('authorization') !== `Bearer ${token}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') ?? '30') || 30));
  const body = await buildSummary(env.DB, Date.now(), days);
  return new Response(JSON.stringify(body, null, 2), { headers: { 'content-type': 'application/json' } });
}
