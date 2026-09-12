import { describe, it, expect } from 'vitest';
import { resolveIntervalMs, ADAPTIVE_DEFAULT_MS } from '../../../src/core/session/resolveIntervalMs';
import { defaultSettings } from '../../../src/core/storage/StorageSchema';

describe('resolveIntervalMs', () => {
  it('resolves fixed presets to minutes', () => {
    expect(resolveIntervalMs({ ...defaultSettings(), challengeInterval: '10min' })).toBe(10 * 60_000);
    expect(resolveIntervalMs({ ...defaultSettings(), challengeInterval: '30min' })).toBe(30 * 60_000);
    expect(resolveIntervalMs({ ...defaultSettings(), challengeInterval: '1hour' })).toBe(60 * 60_000);
  });

  it('resolves "off" to null (never fire)', () => {
    expect(resolveIntervalMs({ ...defaultSettings(), challengeInterval: 'off' })).toBeNull();
  });

  it('resolves "adaptive" to the adaptive default', () => {
    expect(resolveIntervalMs({ ...defaultSettings(), challengeInterval: 'adaptive' })).toBe(ADAPTIVE_DEFAULT_MS);
  });

  it('resolves "custom" using customIntervalMinutes', () => {
    const settings = { ...defaultSettings(), challengeInterval: 'custom' as const, customIntervalMinutes: 1 };
    expect(resolveIntervalMs(settings)).toBe(60_000);
  });

  it('clamps a non-positive custom value to at least 1 minute', () => {
    const settings = { ...defaultSettings(), challengeInterval: 'custom' as const, customIntervalMinutes: 0 };
    expect(resolveIntervalMs(settings)).toBe(60_000);
  });
});
