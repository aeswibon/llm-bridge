import type { BridgeSession, Message, ToolDefinition, StreamChunk } from '@llm-bridge/core';

export class CopilotBridgeSession implements BridgeSession {
  async *send(_messages: Message[], _tools?: ToolDefinition[]): AsyncIterable<StreamChunk> {
    // TODO: Implement Copilot session
  }

  async dispose(): Promise<void> {
    // TODO: Implement dispose
  }
}
