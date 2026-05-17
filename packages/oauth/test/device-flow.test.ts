import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeviceFlow } from '../src/device-flow.js';
import type { OAuthConfig, TokenStore, StoredToken } from '../src/types.js';

function createMockStore(): TokenStore {
  const data = new Map<string, StoredToken>();
  return {
    async set(provider: string, token: StoredToken) { data.set(provider, token); },
    async get(provider: string) { return data.get(provider) ?? null; },
    async delete(provider: string) { data.delete(provider); },
  };
}

function createDeviceFlowConfig(): OAuthConfig {
  return {
    provider: {
      id: 'github-device',
      name: 'GitHub Device Flow',
      authUrl: 'https://github.com/login/device/code',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scopes: ['read:user'],
      clientId: 'test-client-id',
      deviceFlow: true,
    },
    store: createMockStore(),
  };
}

describe('DeviceFlow', () => {
  let config: OAuthConfig;
  let flow: DeviceFlow;

  beforeEach(() => {
    config = createDeviceFlowConfig();
    flow = new DeviceFlow(config);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('start', () => {
    it('requests device code and returns authorization info', async () => {
      const mockResponse = {
        device_code: 'device-abc',
        user_code: 'USER-123',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      };

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await flow.start();

      expect(result).toEqual({
        deviceCode: 'device-abc',
        userCode: 'USER-123',
        verificationUri: 'https://github.com/login/device',
      });
    });

    it('throws if device code request fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'error',
      } as Response);

      await expect(flow.start()).rejects.toThrow('Device code request failed: 400');
    });
  });

  describe('poll', () => {
    it('polls until token is received', async () => {
      vi.useFakeTimers();

      const deviceFlow = new DeviceFlow(config);
      (deviceFlow as unknown as Record<string, unknown>).deviceCode = 'device-abc';
      (deviceFlow as unknown as Record<string, unknown>).interval = 100;
      (deviceFlow as unknown as Record<string, unknown>).expiresAt = Date.now() + 1000;

      const mockToken = {
        access_token: 'access-123',
        refresh_token: 'refresh-123',
        expires_in: 3600,
        scope: 'read:user',
      };

      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return {
            ok: false,
            json: async () => ({ error: 'authorization_pending' }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => mockToken,
        } as Response;
      });

      const pollPromise = deviceFlow.poll();

      await vi.advanceTimersByTimeAsync(300);

      const token = await pollPromise;
      expect(token.accessToken).toBe('access-123');

      vi.useRealTimers();
    });

    it('throws if polling expires', async () => {
      vi.useFakeTimers();

      const deviceFlow = new DeviceFlow(config);
      (deviceFlow as unknown as Record<string, unknown>).deviceCode = 'device-expired';
      (deviceFlow as unknown as Record<string, unknown>).interval = 100;
      (deviceFlow as unknown as Record<string, unknown>).expiresAt = Date.now() + 200;

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'authorization_pending' }),
      } as Response);

      const pollPromise = deviceFlow.poll();
      const caught = pollPromise.catch((e) => e);

      await vi.advanceTimersByTimeAsync(300);

      const result = await caught;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Device flow expired');

      vi.useRealTimers();
    });

    it('throws on slow_down error with backoff', async () => {
      vi.useFakeTimers();

      const deviceFlow = new DeviceFlow(config);
      (deviceFlow as unknown as Record<string, unknown>).deviceCode = 'device-slow';
      (deviceFlow as unknown as Record<string, unknown>).interval = 100;
      (deviceFlow as unknown as Record<string, unknown>).expiresAt = Date.now() + 30000;

      let callCount = 0;
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          return {
            ok: false,
            json: async () => ({ error: 'slow_down' }),
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ access_token: 'token', expires_in: 3600 }),
        } as Response;
      });

      const pollPromise = deviceFlow.poll();
      await vi.advanceTimersByTimeAsync(20000);
      const token = await pollPromise;
      expect(token.accessToken).toBe('token');

      vi.useRealTimers();
    });

    it('throws if poll() is called without start()', async () => {
      const newFlow = new DeviceFlow(config);
      await expect(newFlow.poll()).rejects.toThrow('No device code. Call start() first.');
    });

    it('throws on generic error from token endpoint', async () => {
      vi.useFakeTimers();

      const deviceFlow = new DeviceFlow(config);
      (deviceFlow as unknown as Record<string, unknown>).deviceCode = 'device-err';
      (deviceFlow as unknown as Record<string, unknown>).interval = 100;
      (deviceFlow as unknown as Record<string, unknown>).expiresAt = Date.now() + 1000;

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'access_denied' }),
      } as Response);

      const caught = deviceFlow.poll().catch((e) => e);
      await vi.advanceTimersByTimeAsync(200);
      const err = await caught;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe('Device flow error: access_denied');

      vi.useRealTimers();
    });

    it('calls store.set with provider ID and token on success', async () => {
      vi.useFakeTimers();

      const store = createMockStore();
      const setSpy = vi.spyOn(store, 'set');

      const deviceFlow = new DeviceFlow({ ...config, store });
      (deviceFlow as unknown as Record<string, unknown>).deviceCode = 'device-store';
      (deviceFlow as unknown as Record<string, unknown>).interval = 100;
      (deviceFlow as unknown as Record<string, unknown>).expiresAt = Date.now() + 1000;

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'access-456',
          refresh_token: 'refresh-456',
          expires_in: 7200,
          scope: 'read:user repo',
        }),
      } as Response);

      const pollPromise = deviceFlow.poll();
      await vi.advanceTimersByTimeAsync(200);
      await pollPromise;

      expect(setSpy).toHaveBeenCalledWith('github-device', expect.objectContaining({
        accessToken: 'access-456',
        refreshToken: 'refresh-456',
        scopes: ['read:user', 'repo'],
      }));

      vi.useRealTimers();
    });
  });

  describe('start error body', () => {
    it('includes response body in error message', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => '{"error":"invalid_client","error_description":"Client ID is invalid"}',
      } as Response);

      await expect(flow.start()).rejects.toThrow(
        'Device code request failed: 400 {"error":"invalid_client","error_description":"Client ID is invalid"}',
      );
    });
  });
});
