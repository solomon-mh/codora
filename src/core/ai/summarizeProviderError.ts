const DEFAULT_MAX_CHARS = 220;

/**
 * Condenses a provider error into one readable line.
 *
 * Provider errors are frequently a wall of JSON — a Gemini quota error is
 * ~1.5KB of nested `details`/`violations`/`retryInfo` that says the same
 * thing as its one `error.message` field. Logging or displaying that
 * verbatim (twice per attempt, three attempts per provider) buries
 * everything else, so the human-readable message is pulled out and the
 * result is capped.
 */
export function summarizeProviderError(reason: string | undefined, maxChars = DEFAULT_MAX_CHARS): string {
  if (!reason) return 'no usable question returned';

  let text = reason;
  const jsonStart = reason.indexOf('{');
  if (jsonStart !== -1) {
    try {
      const parsed = JSON.parse(reason.slice(jsonStart)) as { error?: { message?: string } };
      const message = parsed.error?.message;
      if (message) {
        const prefix = reason.slice(0, jsonStart).trim();
        text = prefix ? `${prefix} ${message}` : message;
      }
    } catch {
      // Not JSON after all — fall through and just truncate the raw text.
    }
  }

  text = text.replace(/\s+/g, ' ').trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}
