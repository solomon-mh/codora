import { describe, it, expect } from 'vitest';
import { pickNewestClaudeExtensionDir } from '../../../src/core/ai/ClaudeCliProvider';

describe('pickNewestClaudeExtensionDir', () => {
  it('ignores unrelated extension directories', () => {
    expect(pickNewestClaudeExtensionDir(['ms-python.python-2024.1', 'github.copilot-1.2.3'])).toBeUndefined();
  });

  it('finds the Claude Code extension directory', () => {
    const dirs = ['ms-python.python-2024.1', 'anthropic.claude-code-2.1.269-linux-x64'];
    expect(pickNewestClaudeExtensionDir(dirs)).toBe('anthropic.claude-code-2.1.269-linux-x64');
  });

  it('compares version segments numerically, not lexicographically', () => {
    // Plain string sorting puts "2.1.9" above "2.1.269", which would pin an
    // older CLI after an upgrade.
    const dirs = ['anthropic.claude-code-2.1.9-linux-x64', 'anthropic.claude-code-2.1.269-linux-x64'];
    expect(pickNewestClaudeExtensionDir(dirs)).toBe('anthropic.claude-code-2.1.269-linux-x64');
  });

  it('prefers a newer major version', () => {
    const dirs = ['anthropic.claude-code-2.1.269-linux-x64', 'anthropic.claude-code-10.0.1-linux-x64'];
    expect(pickNewestClaudeExtensionDir(dirs)).toBe('anthropic.claude-code-10.0.1-linux-x64');
  });

  it('returns undefined for an empty listing', () => {
    expect(pickNewestClaudeExtensionDir([])).toBeUndefined();
  });
});
