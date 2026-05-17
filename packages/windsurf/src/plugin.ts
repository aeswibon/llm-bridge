import type { BridgePlugin, BridgeSession, ModelInfo } from '@llm-bridge/core';
import { WindsurfBridgeSession } from './session.js';
import { WINDSURF_MODELS } from './models.js';
import type { WindsurfConfig } from './types.js';
import { getToken, validateToken } from './auth.js';
import { createWindsurfDaemon } from './daemon.js';

export class WindsurfBridgePlugin implements BridgePlugin {
  name = 'windsurf';
  version = '2.0.0';

  async authenticate(config: Record<string, string>): Promise<boolean> {
    const token = getToken(config as WindsurfConfig);
    if (!token) return false;
    return validateToken(token);
  }

  async listModels(config: Record<string, string>): Promise<ModelInfo[]> {
    const token = getToken(config as WindsurfConfig);
    if (!token) throw new Error('Missing WINDSURF_TOKEN');
    return WINDSURF_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      capabilities: m.capabilities,
    }));
  }

  async createSession(config: Record<string, string>, model: string): Promise<BridgeSession> {
    const token = getToken(config as WindsurfConfig);
    if (!token) throw new Error('Missing WINDSURF_TOKEN');
    const daemon = createWindsurfDaemon();
    return new WindsurfBridgeSession(daemon, token, model);
  }
}
