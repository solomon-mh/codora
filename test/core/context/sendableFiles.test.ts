import { describe, it, expect } from 'vitest';
import { isSendableSourcePath, looksBinary } from '../../../src/core/context/sendableFiles';

describe('isSendableSourcePath', () => {
  it('accepts source code in known languages', () => {
    for (const p of ['src/app.ts', 'web/App.tsx', 'main.py', 'cmd/server/main.go', 'src/lib.rs', 'Foo.java', 'a/b/c.cpp']) {
      expect(isSendableSourcePath(p), p).toBe(true);
    }
  });

  it('refuses environment, key and certificate files', () => {
    for (const p of ['.env', '.env.local', 'config/.env.production', 'certs/server.pem', 'server.key', 'id_rsa', 'keystore.p12']) {
      expect(isSendableSourcePath(p), p).toBe(false);
    }
  });

  it('refuses config, data and lock files', () => {
    for (const p of ['package-lock.json', 'credentials.json', 'config.yaml', 'settings.toml', 'yarn.lock', 'README.md', 'logo.png']) {
      expect(isSendableSourcePath(p), p).toBe(false);
    }
  });

  it('refuses source files named like secrets', () => {
    for (const p of ['src/secrets.ts', 'config/credentials.py', 'lib/apiKeys.js', 'auth/password.go', 'privateKey.ts']) {
      expect(isSendableSourcePath(p), p).toBe(false);
    }
  });

  it('refuses anything inside key, credential or dependency folders', () => {
    for (const p of ['.aws/config.py', '.ssh/helper.sh.js', 'secrets/db.ts', 'node_modules/lodash/index.js', 'vendor/lib.php', '.venv/lib/site.py']) {
      expect(isSendableSourcePath(p), p).toBe(false);
    }
  });

  it('handles Windows separators', () => {
    expect(isSendableSourcePath('src\\core\\app.ts')).toBe(true);
    expect(isSendableSourcePath('.aws\\handler.py')).toBe(false);
  });
});

describe('looksBinary', () => {
  it('flags text with a NUL byte and passes ordinary code', () => {
    expect(looksBinary('PNG\0\0data')).toBe(true);
    expect(looksBinary('export const x = 1;\n')).toBe(false);
  });
});
