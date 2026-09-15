/**
 * Whether re-sending the same request to the same provider could plausibly
 * succeed. Retrying a bad key or an exhausted quota can't — and on a
 * metered/free-tier key, each pointless retry burns real quota (observed:
 * three identical 429s per challenge against a 20-request/day limit,
 * exhausting it three times faster than necessary).
 */
export function isRetryableProviderError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  // Auth / permission — a different key is needed, not another attempt.
  if (/\b401\b|\b403\b|unauthor|incorrect api key|invalid api key|permission/.test(message)) return false;
  // Quota / rate limit — the retry delay these report is far longer than a challenge cycle.
  if (/\b429\b|quota|rate limit|resource_exhausted|insufficient_quota/.test(message)) return false;
  // Unknown or retired model id — every attempt will 404 identically.
  if (/\b404\b|not_found|no longer available|does not exist|unknown model/.test(message)) return false;

  return true;
}
