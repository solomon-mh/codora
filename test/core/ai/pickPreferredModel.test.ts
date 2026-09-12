import { describe, it, expect } from 'vitest';
import { pickPreferredModel } from '../../../src/core/ai/pickPreferredModel';

describe('pickPreferredModel', () => {
  it('returns undefined when no models are available', () => {
    expect(pickPreferredModel([])).toBeUndefined();
  });

  it('prefers a Claude/Codex-style agent over Copilot, marked as a known agent', () => {
    const copilot = { vendor: 'copilot', family: 'gpt-4o', name: 'GPT-4o' };
    const claude = { vendor: 'anthropic', family: 'claude-sonnet', name: 'Claude' };
    expect(pickPreferredModel([copilot, claude])).toEqual({ model: claude, isKnownAgent: true });
    expect(pickPreferredModel([claude, copilot])).toEqual({ model: claude, isKnownAgent: true });
  });

  it('matches an agent by name even if vendor/family are generic', () => {
    const generic = { vendor: 'acme', family: 'chat-v1', name: 'Codex Assistant' };
    const copilot = { vendor: 'copilot', family: 'gpt-4o', name: 'GPT-4o' };
    expect(pickPreferredModel([copilot, generic])).toEqual({ model: generic, isKnownAgent: true });
  });

  it('falls back to Copilot when no known agent is present, marked as not a known agent', () => {
    const copilot = { vendor: 'copilot', family: 'gpt-4o', name: 'GPT-4o' };
    const other = { vendor: 'someext', family: 'llama', name: 'Local Llama' };
    expect(pickPreferredModel([other, copilot])).toEqual({ model: copilot, isKnownAgent: false });
  });

  it('falls back to the first model when nothing recognizable is present', () => {
    const a = { vendor: 'someext', family: 'llama', name: 'Local Llama' };
    const b = { vendor: 'otherext', family: 'mistral', name: 'Mistral' };
    expect(pickPreferredModel([a, b])).toEqual({ model: a, isKnownAgent: false });
  });

  it('never mistakes Copilot itself for a known agent even if its family mentions gpt, and flags it as generic (e.g. an "Auto" router)', () => {
    const copilotAuto = { vendor: 'copilot', family: 'gpt-4o', name: 'Auto' };
    expect(pickPreferredModel([copilotAuto])).toEqual({ model: copilotAuto, isKnownAgent: false });
  });
});
