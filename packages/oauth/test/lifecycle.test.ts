import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenLifecycle } from '../src/lifecycle.js';
import type { TokenStore, StoredToken, OAuthConfig, OAuthProvider } from '../src/types.js';

function createMockStore(): TokenStore {
  const data = new Map<string, StoredToken>();
  return {
    async set(provider: string, token: StoredToken) {
      data.set(provider, token);
    },
    async get(provider: string) {
      return data.get(provider) ?? null;
    },
    async delete(provider: string) {
      data.delete(provider);
    },
  };
}

const testProvider: OAuthProvider = {
  id: 'test',
  name: 'Test',
  authUrl: 'https://example.com/authorize',
  tokenUrl: 'https://example.com/token',
  scopes: ['read:user'],
  clientId: 'test-id',
};

describe('TokenLifecycle', () => {
  let store: ReturnType<typeof createMockStore>;
  let lifecycle: TokenLifecycle;

  beforeEach(() => {
    store = createMockStore();
    lifecycle = new TokenLifecycle(store);
  });

  describe('isValid', () => {
    it('returns false when no token exists', async () => {
      const valid = await lifecycle.isValid('nonexistent');
      expect(valid).toBe(false);
    });

    it('returns false when token is expired', async () => {
      const expiredToken: StoredToken = {
        version: 1,
        accessToken: 'expired',
        expiresAt: Date.now() - 1000,
        scopes: [],
      };
      await store.set('test', expiredToken);

      const valid = await lifecycle.isValid('test');
      expect(valid).toBe(false);
    });

    it('returns true when token is valid', async () => {
      const validToken: StoredToken = {
        version: 1,
        accessToken: 'valid',
        expiresAt: Date.now() + 3600000,
        scopes: [],
      };
      await store.set('test', validToken);

      const isValid = await lifecycle.isValid('test');
      expect(isValid).toBe(true);
    });

    it('returns false when token expires within grace period', async () => {
      const nearlyExpired: StoredToken = {
        version: 1,
        accessToken: 'nearly-expired',
        expiresAt: Date.now() + 10000,
        scopes: [],
      };
      await store.set('test', nearlyExpired);

      const lifecycleWithGrace = new TokenLifecycle(store, { gracePeriodMs: 60000 });
      const valid = await lifecycleWithGrace.isValid('test');
      expect(valid).toBe(false);
    });
  });

  describe('refresh', () => {
    it('refreshes token using refresh_token grant', async () => {
      const existingToken: StoredToken = {
        version: 1,
        accessToken: 'old-access',
        refreshToken: 'refresh-123',
        expiresAt: Date.now() - 1000,
        scopes: ['read:user'],
      };
      await store.set('test', existingToken);

      const newTokenData = {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        scope: 'read:user',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => newTokenData,
      } as Response);

      const config: OAuthConfig = { provider: testProvider, store };
      const lifecycleWithConfig = new TokenLifecycle(store, { config });
      const refreshed = await lifecycleWithConfig.refresh('test');

      expect(refreshed.accessToken).toBe('new-access');
      expect(fetchSpy).toHaveBeenCalledWith(
        testProvider.tokenUrl,
        expect.objectContaining({
          method: 'POST',
        }),
      );

      fetchSpy.mockRestore();
    });

    it('throws when no refresh token available', async () => {
      const noRefreshToken: StoredToken = {
        version: 1,
        accessToken: 'no-refresh',
        expiresAt: Date.now() - 1000,
        scopes: [],
      };
      await store.set('test', noRefreshToken);

      const config: OAuthConfig = { provider: testProvider, store };
      const lifecycleWithConfig = new TokenLifecycle(store, { config });

      await expect(lifecycleWithConfig.refresh('test')).rejects.toThrow(
        'No refresh token available',
      );
    });

    it('throws when OAuthConfig is not provided', async () => {
      const existingToken: StoredToken = {
        version: 1,
        accessToken: 'old',
        refreshToken: 'refresh',
        expiresAt: Date.now() - 1000,
        scopes: [],
      };
      await store.set('test', existingToken);

      const lifecycleWithoutConfig = new TokenLifecycle(store);

      await expect(lifecycleWithoutConfig.refresh('test')).rejects.toThrow(
        'OAuthConfig required for token refresh',
      );
    });

    it('calls onRefresh callback with new token', async () => {
      const existingToken: StoredToken = {
        version: 1,
        accessToken: 'old',
        refreshToken: 'refresh',
        expiresAt: Date.now() - 1000,
        scopes: [],
      };
      await store.set('test', existingToken);

      const onRefresh = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new', expires_in: 3600 }),
      } as Response);

      const config: OAuthConfig = { provider: testProvider, store, onRefresh };
      const lifecycleWithConfig = new TokenLifecycle(store, { config });
      await lifecycleWithConfig.refresh('test');

      expect(onRefresh).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'new',
        }),
      );
    });

    it('throws on refresh failure', async () => {
      const existingToken: StoredToken = {
        version: 1,
        accessToken: 'old',
        refreshToken: 'refresh',
        expiresAt: Date.now() - 1000,
        scopes: [],
      };
      await store.set('test', existingToken);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'invalid_grant',
      } as Response);

      const config: OAuthConfig = { provider: testProvider, store };
      const lifecycleWithConfig = new TokenLifecycle(store, { config });

      await expect(lifecycleWithConfig.refresh('test')).rejects.toThrow(
        'Token refresh failed: 400',
      );
    });

    it('preserves refresh_token when server does not return a new one', async () => {
      const existingToken: StoredToken = {
        version: 1,
        accessToken: 'old',
        refreshToken: 'keep-this-refresh',
        expiresAt: Date.now() - 1000,
        scopes: ['read:user'],
      };
      await store.set('test', existingToken);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-access', expires_in: 3600 }),
      } as Response);

      const config: OAuthConfig = { provider: testProvider, store };
      const lifecycleWithConfig = new TokenLifecycle(store, { config });
      const refreshed = await lifecycleWithConfig.refresh('test');

      expect(refreshed.refreshToken).toBe('keep-this-refresh');
    });

    it('preserves scopes from the original token', async () => {
      const existingToken: StoredToken = {
        version: 1,
        accessToken: 'old',
        refreshToken: 'refresh',
        expiresAt: Date.now() - 1000,
        scopes: ['read:user', 'write:repo'],
      };
      await store.set('test', existingToken);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new', expires_in: 3600 }),
      } as Response);

      const config: OAuthConfig = { provider: testProvider, store };
      const lifecycleWithConfig = new TokenLifecycle(store, { config });
      const refreshed = await lifecycleWithConfig.refresh('test');

      expect(refreshed.scopes).toEqual(['read:user', 'write:repo']);
    });

    it('throws if token response is missing access_token', async () => {
      const existingToken: StoredToken = {
        version: 1,
        accessToken: 'old',
        refreshToken: 'refresh',
        expiresAt: Date.now() - 1000,
        scopes: [],
      };
      await store.set('test', existingToken);

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ expires_in: 3600 }),
      } as Response);

      const config: OAuthConfig = { provider: testProvider, store };
      const lifecycleWithConfig = new TokenLifecycle(store, { config });

      await expect(lifecycleWithConfig.refresh('test')).rejects.toThrow(
        'Invalid token response: missing access_token',
      );
    });
  });
});
