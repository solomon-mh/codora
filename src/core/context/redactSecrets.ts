/**
 * Replaces credentials written into source code with a placeholder before
 * a snippet leaves the machine. isSendableSourcePath keeps key and .env
 * files out entirely; this covers a key pasted straight into ordinary code
 * (`const KEY = "sk-ant-…"`). The redacted snippet is also what the
 * developer sees and what is stored, so a key is never kept in history.
 *
 * Patterns are deliberately specific (known key formats, or a value
 * assigned to a name that says it is secret) so ordinary strings in code
 * survive and questions still make sense.
 */
export const REDACTED = '[redacted]';

const KEY_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
  /\bsk-ant-[A-Za-z0-9_-]{20,}/g, // Anthropic
  /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g, // OpenAI
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, // AWS access key id
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API key
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, // GitHub token
  /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, // GitHub fine-grained token
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, // Slack
  /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g, // Stripe
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
];

/** `password = "…"`, `apiKey: '…'`, `CLIENT_SECRET="…"`: keeps the name, hides a quoted value of 8+ characters. */
const SECRET_ASSIGNMENT =
  /((?:passw(?:or)?d|secret|api[-_]?key|access[-_]?key|auth[-_]?token|access[-_]?token|private[-_]?key|client[-_]?secret)[A-Za-z0-9_]*["']?\s*[:=]\s*)(["'`])[^"'`\s]{8,}\2/gi;

/** `postgres://user:hunter22@host`: keeps the user and host, hides the password. */
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@'"`]+:)[^\s@'"`]+@/gi;

export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of KEY_PATTERNS) out = out.replace(pattern, REDACTED);
  out = out.replace(SECRET_ASSIGNMENT, (_m, prefix: string, quote: string) => `${prefix}${quote}${REDACTED}${quote}`);
  out = out.replace(URL_CREDENTIALS, (_m, prefix: string) => `${prefix}${REDACTED}@`);
  return out;
}
