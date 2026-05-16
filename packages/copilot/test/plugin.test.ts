import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopilotBridgePlugin } from '../src/plugin.js';
import * as auth from '../src/auth.js';
import { COPILOT_MODELS } from '../src/types.js';

vi.mock('../src/auth.js', () => ({
  validateToken: vi.fn(),
  getToken: vi.fn(),
  refreshOAuthToken: vi.fn(),
}));

describe('CopilotBridgePlugin', () => {
  let plugin: CopilotBridgePlugin;

  beforeEach(() => {
    plugin = new CopilotBridgePlugin();
    vi.clearAllMocks();
  });

  it('authenticates with valid token', async () => {
    (auth.validateToken as any).mockResolvedValue(true);
    (auth.getToken as any).mockReturnValue('ghp_test_token');
    const result = await plugin.authenticate({ COPILOT_TOKEN: 'ghp_test_token' });
    expect(result).toBe(true);
    expect(auth.validateToken).toHaveBeenCalledWith('ghp_test_token');
  });

  it('fails authentication with missing token', async () => {
    (auth.getToken as any).mockReturnValue(null);
    const result = await plugin.authenticate({});
    expect(result).toBe(false);
  });

  it('fails authentication with invalid token', async () => {
    (auth.validateToken as any).mockResolvedValue(false);
    (auth.getToken as any).mockReturnValue('invalid');
    const result = await plugin.authenticate({ COPILOT_TOKEN: 'invalid' });
    expect(result).toBe(false);
  });

  it('lists models', async () => {
    (auth.getToken as any).mockReturnValue('ghp_test_token');
    const models = await plugin.listModels({ COPILOT_TOKEN: 'ghp_test_token' });
    expect(models.length).toBeGreaterThan(0);
    expect(models[0].id).toBe(COPILOT_MODELS[0].id);
  });

  it('throws on listModels without token', async () => {
    (auth.getToken as any).mockReturnValue(null);
    await expect(plugin.listModels({})).rejects.toThrow('Missing COPILOT_TOKEN');
  });

  it('creates a session', async () => {
    (auth.getToken as any).mockReturnValue('ghp_test_token');
    const session = await plugin.createSession(
      { COPILOT_TOKEN: 'ghp_test_token' },
      'gpt-4o-copilot',
    );
    expect(session).toBeDefined();
    expect(typeof session.send).toBe('function');
    expect(typeof session.dispose).toBe('function');
  });

  it('throws on createSession without token', async () => {
    (auth.getToken as any).mockReturnValue(null);
    await expect(plugin.createSession({}, 'gpt-4o-copilot')).rejects.toThrow(
      'Missing COPILOT_TOKEN',
    );
  });
});
