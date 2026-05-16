import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthFlow } from '../src/flow.js';
import type { OAuthConfig, TokenStore, StoredToken } from '../src/types.js';

function createMockStore(): TokenStore & { getData(): Map<string, StoredToken> } {
  const data = new Map<string, StoredToken>();
  return {
    async set(provider: string, token: StoredToken) { data.set(provider, token); },
    async get(provider: string) { return data.get(provider) ?? null; },
    async delete(provider: string) { data.delete(provider); },
    getData() { return data; },
  };
}

function createMockConfig(): OAuthConfig {
  return {
    provider: {
      id: 'test-provider',
      name: 'Test Provider',
      authUrl: 'https://example.com/authorize',
      tokenUrl: 'https://example.com/token',
      scopes: ['read:user'],
      clientId: 'test-client-id',
    },
    store: createMockStore(),
  };
}

describe('OAuthFlow', () => {
  let config: OAuthConfig;
  let store: ReturnType<typeof createMockStore>;
  let flow: OAuthFlow;

  beforeEach(() => {
    config = createMockConfig();
    store = config.store as ReturnType<typeof createMockStore>;
    flow = new OAuthFlow(config, store);
  });

  describe('start', () => {
    it('returns an authorization URL with PKCE parameters', async () => {
      const url = await flow.start();

      expect(url).toContain(config.provider.authUrl);
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('scope=read%3Auser');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('state=');
    });

    it('includes redirect_uri if configured', async () => {
      const configWithRedirect: OAuthConfig = {
        ...config,
        provider: { ...config.provider },
      };
      (configWithRedirect.provider as Record<string, unknown>).redirectUri = 'http://localhost:3000/callback';
      const flowWithRedirect = new OAuthFlow(configWithRedirect, store);
      const url = await flowWithRedirect.start();
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
    });

    it('generates different state values for each call', async () => {
      const url1 = await flow.start();
      const url2 = await flow.start();

      const state1 = new URL(url1).searchParams.get('state');
      const state2 = new URL(url2).searchParams.get('state');
      expect(state1).not.toBe(state2);
    });
  });

  describe('callback', () => {
    it('exchanges authorization code for tokens', async () => {
      await flow.start();

      const mockTokenResponse: StoredToken = {
        version: 1,
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
        expiresAt: Date.now() + 3600000,
        scopes: ['read:user'],
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const token = await flow.callback('auth-code-123');

      expect(token).toEqual(mockTokenResponse);
      expect(fetchSpy).toHaveBeenCalled();
      const fetchCall = fetchSpy.mock.calls[0];
      expect(fetchCall[0]).toBe(config.provider.tokenUrl);

      fetchSpy.mockRestore();
    });

    it('stores the token after successful exchange', async () => {
      await flow.start();

      const mockTokenResponse: StoredToken = {
        version: 1,
        accessToken: 'access-456',
        refreshToken: 'refresh-456',
        expiresAt: Date.now() + 3600000,
        scopes: ['read:user'],
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      await flow.callback('auth-code-456');

      const stored = await store.get(config.provider.id);
      expect(stored).toEqual(mockTokenResponse);
    });

    it('throws on failed token exchange', async () => {
      await flow.start();

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'invalid_grant',
      } as Response);

      await expect(flow.callback('bad-code')).rejects.toThrow('Token exchange failed: 400');
    });

    it('throws if callback called before start', async () => {
      const freshFlow = new OAuthFlow(config, store);
      await expect(freshFlow.callback('orphan-code')).rejects.toThrow('No pending PKCE state');
    });
  });
});
