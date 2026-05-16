import { Cursor } from '@cursor/sdk';
import type { BridgePlugin, BridgeSession, ModelInfo } from '@llm-bridge/core';
import { CursorBridgeSession } from './session.js';

export class CursorBridgePlugin implements BridgePlugin {
  name = 'cursor';
  version = '2.0.0';

  async authenticate(config: Record<string, string>): Promise<boolean> {
    const apiKey = config.CURSOR_API_KEY;
    if (!apiKey) return false;
    try {
      await Cursor.me({ apiKey });
      return true;
    } catch {
      return false;
    }
  }

  async listModels(config: Record<string, string>): Promise<ModelInfo[]> {
    const apiKey = config.CURSOR_API_KEY;
    if (!apiKey) throw new Error('Missing CURSOR_API_KEY');
    const models = await Cursor.models.list({ apiKey });
    return models.map((m) => ({
      id: m.id,
      name: m.id,
      capabilities: { streaming: true, tools: true },
    }));
  }

  async createSession(config: Record<string, string>, model: string): Promise<BridgeSession> {
    const apiKey = config.CURSOR_API_KEY;
    if (!apiKey) throw new Error('Missing CURSOR_API_KEY');
    const cwd = config.CURSOR_OPENCODE_BRIDGE_CWD ?? process.cwd();
    return new CursorBridgeSession(apiKey, model, cwd);
  }
}
