import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CursorBridgePlugin } from '../src/plugin.js';

describe('CursorBridgePlugin', () => {
  let plugin: CursorBridgePlugin;

  beforeEach(() => {
    plugin = new CursorBridgePlugin();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when no API key', async () => {
    expect(await plugin.authenticate({})).toBe(false);
  });

  it('returns true on successful auth', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    expect(await plugin.authenticate({ CURSOR_API_KEY: 'test' })).toBe(true);
  });

  it('returns false on failed auth', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
    expect(await plugin.authenticate({ CURSOR_API_KEY: 'test' })).toBe(false);
  });

  it('throws when listing models without API key', async () => {
    await expect(plugin.listModels({})).rejects.toThrow('Missing CURSOR_API_KEY');
  });

  it('returns default models when API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as Response);
    const models = await plugin.listModels({ CURSOR_API_KEY: 'test' });
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toBeDefined();
  });

  it('creates session with valid API key', async () => {
    const session = await plugin.createSession({ CURSOR_API_KEY: 'test' }, 'composer-2');
    expect(session).toBeDefined();
    expect(session.send).toBeDefined();
    expect(session.dispose).toBeDefined();
  });

  it('throws when creating session without API key', async () => {
    await expect(plugin.createSession({}, 'composer-2')).rejects.toThrow('Missing CURSOR_API_KEY');
  });
});
