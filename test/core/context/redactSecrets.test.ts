import { describe, it, expect } from 'vitest';
import { redactSecrets, REDACTED } from '../../../src/core/context/redactSecrets';

// Built from parts so this file doesn't itself look like it holds real keys.
const fake = (prefix: string, body: string) => prefix + body;

describe('redactSecrets', () => {
  it('hides known API key formats', () => {
    const keys = [
      fake('sk-ant-', 'api03-' + 'a'.repeat(40)),
      fake('sk-proj-', 'b'.repeat(40)),
      fake('AKIA', 'ABCDEFGHIJKLMNOP'),
      fake('AIza', 'c'.repeat(35)),
      fake('ghp_', 'd'.repeat(36)),
      fake('xoxb-', '1234567890-abcdef'),
      fake('sk_live_', 'e'.repeat(24)),
    ];
    for (const key of keys) {
      const out = redactSecrets(`const client = new Client("${key}");`);
      expect(out, key).not.toContain(key);
      expect(out, key).toContain(REDACTED);
    }
  });

  it('hides a private key block', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nIBAAK\n-----END RSA PRIVATE KEY-----';
    expect(redactSecrets(`const key = \`${pem}\`;`)).toBe(`const key = \`${REDACTED}\`;`);
  });

  it('hides a private key block that has no END marker, to the end of the text', () => {
    const cut = 'const a = 1;\nconst key = `-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQ';
    expect(redactSecrets(cut)).toBe(`const a = 1;\nconst key = \`${REDACTED}`);
  });

  it('keeps redacting each of several private key blocks separately', () => {
    const two = '-----BEGIN PRIVATE KEY-----\nA\n-----END PRIVATE KEY-----\nconst x = 1;\n-----BEGIN EC PRIVATE KEY-----\nB\n-----END EC PRIVATE KEY-----';
    expect(redactSecrets(two)).toBe(`${REDACTED}\nconst x = 1;\n${REDACTED}`);
  });

  it('keeps the name but hides a secret-looking assignment', () => {
    expect(redactSecrets('const password = "hunter2hunter2";')).toBe(`const password = "${REDACTED}";`);
    expect(redactSecrets("config = { apiKey: 'abcd1234efgh' }")).toBe(`config = { apiKey: '${REDACTED}' }`);
    expect(redactSecrets('CLIENT_SECRET="s3cr3tvalue99"')).toBe(`CLIENT_SECRET="${REDACTED}"`);
  });

  it('hides the password in a connection string', () => {
    expect(redactSecrets('connect("postgres://app:hunter22@db.local:5432/app")')).toBe(
      `connect("postgres://app:${REDACTED}@db.local:5432/app")`,
    );
  });

  it('leaves ordinary code alone', () => {
    const code = [
      'function retry(fn, attempts = 3) {',
      '  const label = "fetching user profile";',
      '  if (!token) throw new Error("missing token");',
      '  const password = readPasswordFromVault();',
      '  return fetch("https://api.example.com/users");',
      '}',
    ].join('\n');
    expect(redactSecrets(code)).toBe(code);
  });
});
