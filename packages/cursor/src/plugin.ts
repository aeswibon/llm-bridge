import type { BridgePlugin, BridgeSession, ModelInfo } from '@ai-ide-bridge/core';
import { CursorBridgeSession } from './session.js';

const CURSOR_API_BASE = 'https://api2.cursor.sh';

export class CursorBridgePlugin implements BridgePlugin {
  name = 'cursor';
  version = '2.0.0';

  async authenticate(config: Record<string, string>): Promise<boolean> {
    const apiKey = config.CURSOR_API_KEY;
    if (!apiKey) return false;
    try {
      const response = await fetch(`${CURSOR_API_BASE}/auth/whoami`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(config: Record<string, string>): Promise<ModelInfo[]> {
    const apiKey = config.CURSOR_API_KEY;
    if (!apiKey) throw new Error('Missing CURSOR_API_KEY');

    try {
      const response = await fetch(`${CURSOR_API_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        return defaultModels();
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((m: { id?: string; name?: string }) => ({
          id: m.id ?? m.name ?? 'unknown',
          name: m.name ?? m.id ?? 'unknown',
          capabilities: { streaming: true, tools: true },
        }));
      }
    } catch {
      // Fall through to defaults
    }

    return defaultModels();
  }

  async createSession(config: Record<string, string>, model: string): Promise<BridgeSession> {
    const apiKey = config.CURSOR_API_KEY;
    if (!apiKey) throw new Error('Missing CURSOR_API_KEY');
    return new CursorBridgeSession(apiKey, model);
  }
}

function defaultModels(): ModelInfo[] {
  return [
    { id: 'composer-2', name: 'Composer 2', capabilities: { streaming: true, tools: true } },
    { id: 'composer-2.5', name: 'Composer 2.5', capabilities: { streaming: true, tools: true } },
    { id: 'gpt-4o', name: 'GPT-4o', capabilities: { streaming: true, tools: true } },
    { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', capabilities: { streaming: true, tools: true } },
  ];
}
