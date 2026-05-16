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
        redirectUri: 'http://localhost:3000/callback',
      };
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
      const startUrl = await flow.start();
      const state = new URL(startUrl).searchParams.get('state')!;

      const mockTokenResponse = {
        access_token: 'access-123',
        refresh_token: 'refresh-123',
        expires_in: 3600,
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const token = await flow.callback('auth-code-123', state);

      expect(token.accessToken).toBe('access-123');
      expect(token.refreshToken).toBe('refresh-123');
      expect(fetchSpy).toHaveBeenCalled();
      const fetchCall = fetchSpy.mock.calls[0];
      expect(fetchCall[0]).toBe(config.provider.tokenUrl);

      const body = fetchCall[1]?.body as string;
      expect(body).toContain('code_verifier=');
      expect(body).toContain('grant_type=authorization_code');
      expect(body).toContain('client_id=test-client-id');
      expect(body).toContain('code=auth-code-123');

      fetchSpy.mockRestore();
    });

    it('stores the token after successful exchange', async () => {
      const startUrl = await flow.start();
      const state = new URL(startUrl).searchParams.get('state')!;

      const mockTokenResponse = {
        access_token: 'access-456',
        refresh_token: 'refresh-456',
        expires_in: 3600,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      await flow.callback('auth-code-456', state);

      const stored = await store.get(config.provider.id);
      expect(stored).not.toBeNull();
      expect(stored!.accessToken).toBe('access-456');
      expect(stored!.refreshToken).toBe('refresh-456');
      expect(stored!.version).toBe(1);
      expect(stored!.scopes).toEqual(['read:user']);
    });

    it('throws on state mismatch', async () => {
      await flow.start();

      await expect(flow.callback('auth-code-123', 'wrong-state')).rejects.toThrow('State mismatch');
    });

    it('throws on failed token exchange', async () => {
      const startUrl = await flow.start();
      const state = new URL(startUrl).searchParams.get('state')!;

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'invalid_grant',
      } as Response);

      await expect(flow.callback('bad-code', state)).rejects.toThrow('Token exchange failed: 400');
    });

    it('throws if callback called before start', async () => {
      const freshFlow = new OAuthFlow(config, store);
      await expect(freshFlow.callback('orphan-code', 'any-state')).rejects.toThrow('No pending PKCE state');
    });

    it('throws on network errors', async () => {
      const startUrl = await flow.start();
      const state = new URL(startUrl).searchParams.get('state')!;

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('fetch failed'));

      await expect(flow.callback('auth-code-123', state)).rejects.toThrow('fetch failed');
    });

    it('omits redirect_uri when not configured', async () => {
      const startUrl = await flow.start();
      const state = new URL(startUrl).searchParams.get('state')!;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', expires_in: 3600 }),
      } as Response);

      await flow.callback('code', state);

      const body = fetchSpy.mock.calls[0][1]?.body as string;
      expect(body).not.toContain('redirect_uri');

      fetchSpy.mockRestore();
    });

    it('includes redirect_uri in callback when configured', async () => {
      const configWithRedirect: OAuthConfig = {
        ...config,
        redirectUri: 'http://localhost:3000/callback',
      };
      const flowWithRedirect = new OAuthFlow(configWithRedirect, store);

      const startUrl = await flowWithRedirect.start();
      const state = new URL(startUrl).searchParams.get('state')!;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tok', expires_in: 3600 }),
      } as Response);

      await flowWithRedirect.callback('code', state);

      const body = fetchSpy.mock.calls[0][1]?.body as string;
      expect(body).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');

      fetchSpy.mockRestore();
    });
  });
});
