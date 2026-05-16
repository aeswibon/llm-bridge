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

  it('returns true when API responds with 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
    } as Response);
    const result = await validateToken('valid-token');
    expect(result).toBe(true);
  });

  it('returns false when API responds with error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);
    const result = await validateToken('invalid-token');
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const result = await validateToken('bad-token');
    expect(result).toBe(false);
  });
});
