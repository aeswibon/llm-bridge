import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WindsurfBridgePlugin } from '../src/plugin.js';
import { WINDSURF_MODELS } from '../src/models.js';
import type { WindsurfConfig } from '../src/types.js';

describe('WindsurfBridgePlugin', () => {
  let plugin: WindsurfBridgePlugin;

  beforeEach(() => {
    plugin = new WindsurfBridgePlugin();
  });

  it('has correct name and version', () => {
    expect(plugin.name).toBe('windsurf');
    expect(plugin.version).toBe('2.0.0');
  });

  describe('authenticate', () => {
    it('returns true when token is valid', async () => {
      const config: WindsurfConfig = { WINDSURF_TOKEN: 'valid-token' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);

      const result = await plugin.authenticate(config as Record<string, string>);
      expect(result).toBe(true);
    });

    it('returns false when token is invalid', async () => {
      const config: WindsurfConfig = { WINDSURF_TOKEN: 'invalid-token' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false } as Response);

      const result = await plugin.authenticate(config as Record<string, string>);
      expect(result).toBe(false);
    });

    it('returns false when no token is configured', async () => {
      const config: WindsurfConfig = {};
      const result = await plugin.authenticate(config as Record<string, string>);
      expect(result).toBe(false);
    });
  });

  describe('listModels', () => {
    it('returns all windsurf models', async () => {
      const config: WindsurfConfig = { WINDSURF_TOKEN: 'token' };
      const models = await plugin.listModels(config as Record<string, string>);

      expect(models).toHaveLength(WINDSURF_MODELS.length);
      expect(models[0].id).toBe('claude-4.5-sonnet');
    });

    it('throws when no token is configured', async () => {
      const config: WindsurfConfig = {};
      await expect(plugin.listModels(config as Record<string, string>)).rejects.toThrow('Missing WINDSURF_TOKEN');
    });
  });

  describe('createSession', () => {
    it('creates a WindsurfBridgeSession', async () => {
      const config: WindsurfConfig = { WINDSURF_TOKEN: 'token' };
      const session = await plugin.createSession(config as Record<string, string>, 'claude-4.5-sonnet');

      expect(session).toBeDefined();
      expect(typeof session.send).toBe('function');
      expect(typeof session.dispose).toBe('function');
    });

    it('throws when no token is configured', async () => {
      const config: WindsurfConfig = {};
      await expect(plugin.createSession(config as Record<string, string>, 'claude-4.5-sonnet')).rejects.toThrow('Missing WINDSURF_TOKEN');
    });
  });
});
