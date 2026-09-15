import { describe, it, expect } from 'vitest';
import { isRetryableProviderError } from '../../../src/core/ai/classifyProviderError';

describe('isRetryableProviderError', () => {
  it('does not retry a bad API key', () => {
    expect(
      isRetryableProviderError(new Error('401 Incorrect API key provided: AQ.Ab8RN***. You can find your API key at ...')),
    ).toBe(false);
  });

  it('does not retry an exhausted quota / rate limit', () => {
    const quotaError = new Error(
      '{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}',
    );
    expect(isRetryableProviderError(quotaError)).toBe(false);
  });

  it('does not retry a retired or unknown model id', () => {
    const notFound = new Error(
      '{"error":{"code":404,"message":"This model models/gemini-2.5-flash is no longer available to new users","status":"NOT_FOUND"}}',
    );
    expect(isRetryableProviderError(notFound)).toBe(false);
  });

  it('retries a transient network/server failure', () => {
    expect(isRetryableProviderError(new Error('socket hang up'))).toBe(true);
    expect(isRetryableProviderError(new Error('503 Service Unavailable'))).toBe(true);
  });

  it('handles non-Error values without throwing', () => {
    expect(isRetryableProviderError('429 quota exceeded')).toBe(false);
    expect(isRetryableProviderError(undefined)).toBe(true);
  });
});
