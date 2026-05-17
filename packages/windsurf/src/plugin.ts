import type { BridgePlugin, BridgeSession, ModelInfo } from '@llm-bridge/core';

export class WindsurfBridgePlugin implements BridgePlugin {
  name = 'windsurf';
  version = '2.0.0';

  async authenticate(_config: Record<string, unknown>): Promise<boolean> {
    throw new Error('Not implemented');
  }

  async listModels(_config: Record<string, unknown>): Promise<ModelInfo[]> {
    throw new Error('Not implemented');
  }

  async createSession(
    _config: Record<string, unknown>,
    _model?: string,
  ): Promise<BridgeSession> {
    throw new Error('Not implemented');
  }
}
