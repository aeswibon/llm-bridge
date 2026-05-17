import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getToken, validateToken } from '../src/auth.js';
import type { WindsurfConfig } from '../src/types.js';

describe('getToken', () => {
  it('returns WINDSURF_TOKEN if present', () => {
    const config: WindsurfConfig = { WINDSURF_TOKEN: 'direct-token' };
    expect(getToken(config)).toBe('direct-token');
  });

  it('returns WINDSURF_OAUTH_TOKEN if WINDSURF_TOKEN is absent', () => {
    const config: WindsurfConfig = { WINDSURF_OAUTH_TOKEN: 'oauth-token' };
    expect(getToken(config)).toBe('oauth-token');
  });

  it('prefers WINDSURF_TOKEN over WINDSURF_OAUTH_TOKEN', () => {
    const config: WindsurfConfig = {
      WINDSURF_TOKEN: 'direct-token',
      WINDSURF_OAUTH_TOKEN: 'oauth-token',
    };
    expect(getToken(config)).toBe('direct-token');
  });

  it('returns null when no token is configured', () => {
    const config: WindsurfConfig = {};
    expect(getToken(config)).toBeNull();
  });
});

describe('validateToken', () => {
  it('returns true for valid token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
    } as Response);

    const result = await validateToken('valid-token');
    expect(result).toBe(true);
  });

  it('returns false for invalid token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    const result = await validateToken('invalid-token');
    expect(result).toBe(false);
  });

  it('returns false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const result = await validateToken('bad-token');
    expect(result).toBe(false);
  });
});
