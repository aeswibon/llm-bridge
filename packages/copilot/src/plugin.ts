import type { BridgePlugin, BridgeSession, ModelInfo } from '@ai-ide-bridge/core';
import { CopilotBridgeSession } from './session.js';
import { COPILOT_MODELS, type CopilotConfig } from './types.js';
import { validateToken, getToken } from './auth.js';

export class CopilotBridgePlugin implements BridgePlugin {
  name = 'copilot';
  version = '2.0.0';

  async authenticate(config: Record<string, string>): Promise<boolean> {
    const token = getToken(config as CopilotConfig);
    if (!token) return false;
    return validateToken(token);
  }

  async listModels(config: Record<string, string>): Promise<ModelInfo[]> {
    const token = getToken(config as CopilotConfig);
    if (!token) throw new Error('Missing COPILOT_TOKEN');
    return COPILOT_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      capabilities: m.capabilities,
    }));
  }

  async createSession(config: Record<string, string>, model: string): Promise<BridgeSession> {
    const token = getToken(config as CopilotConfig);
    if (!token) throw new Error('Missing COPILOT_TOKEN');
    return new CopilotBridgeSession(token, model);
  }
}
