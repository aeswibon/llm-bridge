import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getToken, validateToken } from '../src/auth.js';

describe('getToken', () => {
  it('returns COPILOT_TOKEN when present', () => {
    const result = getToken({ COPILOT_TOKEN: 'test-token' });
    expect(result).toBe('test-token');
  });

  it('returns COPILOT_OAUTH_TOKEN when COPILOT_TOKEN is missing', () => {
    const result = getToken({ COPILOT_OAUTH_TOKEN: 'oauth-token' });
    expect(result).toBe('oauth-token');
  });

  it('returns null when no token is present', () => {
    const result = getToken({});
    expect(result).toBeNull();
  });

  it('prefers COPILOT_TOKEN over COPILOT_OAUTH_TOKEN', () => {
    const result = getToken({
      COPILOT_TOKEN: 'primary-token',
      COPILOT_OAUTH_TOKEN: 'fallback-token',
    });
    expect(result).toBe('primary-token');
  });
});

describe('validateToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false on network error', async () => {
    // In test environment, fetch will fail
    const result = await validateToken('invalid-token');
    expect(result).toBe(false);
  });
});
