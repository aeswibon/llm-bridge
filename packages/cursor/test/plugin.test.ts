import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CursorBridgePlugin } from '../src/plugin.js';
import { Cursor } from '@cursor/sdk';

vi.mock('@cursor/sdk', () => ({
  Cursor: {
    me: vi.fn(),
    models: { list: vi.fn() },
  },
  Agent: { create: vi.fn(), prompt: vi.fn() },
}));

describe('CursorBridgePlugin', () => {
  let plugin: CursorBridgePlugin;

  beforeEach(() => {
    plugin = new CursorBridgePlugin();
    vi.clearAllMocks();
  });

  it('authenticates with valid key', async () => {
    (Cursor.me as any).mockResolvedValue({ id: 'user-123' });
    const result = await plugin.authenticate({ CURSOR_API_KEY: 'cursor_test_key' });
    expect(result).toBe(true);
  });

  it('fails authentication with missing key', async () => {
    const result = await plugin.authenticate({});
    expect(result).toBe(false);
  });

  it('lists models', async () => {
    (Cursor.models.list as any).mockResolvedValue([{ id: 'composer-2' }, { id: 'sonnet' }]);
    const models = await plugin.listModels({ CURSOR_API_KEY: 'cursor_test_key' });
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe('composer-2');
  });

  it('throws on listModels without key', async () => {
    await expect(plugin.listModels({})).rejects.toThrow('Missing CURSOR_API_KEY');
  });
});
