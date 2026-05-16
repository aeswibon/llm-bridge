import type { BridgePlugin, BridgeSession, ModelInfo } from '@llm-bridge/core';
import { CopilotBridgeSession } from './session.js';

export class CopilotBridgePlugin implements BridgePlugin {
  name = 'copilot';
  version = '2.0.0';

  async authenticate(_config: Record<string, unknown>): Promise<boolean> {
    return false;
  }

  async listModels(_config: Record<string, unknown>): Promise<ModelInfo[]> {
    return [];
  }

  async createSession(_config: Record<string, unknown>, _model?: string): Promise<BridgeSession> {
    return new CopilotBridgeSession();
  }
}
