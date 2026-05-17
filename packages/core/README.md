# @ai-ide-bridge/core

The core HTTP server, session management, and shared infrastructure for **AI IDE Bridge**.

AI IDE Bridge is a local HTTP server that translates OpenAI-compatible API requests into provider-specific calls (Cursor SDK, GitHub Copilot, Windsurf), enabling any OpenAI-format client to use any AI IDE's model catalog.

## Overview

`@ai-ide-bridge/core` provides the foundational building blocks for creating AI IDE bridge plugins:

- **HTTP Server**: Native Node.js server handling `/health`, `/v1/models`, and `/v1/chat/completions`.
- **OpenAI Parser & Formatter**: Zod-based request validation and SSE stream formatting.
- **Plugin Registry & Model Router**: Manages active plugins and routes requests by model ID prefixes.
- **Session Management**: In-memory session tracking with TTL cleanup.
- **Daemon Manager**: Infrastructure for managing local daemon binaries (stdio/JSON-RPC communication).

## Installation

```bash
npm install @ai-ide-bridge/core
```

## Creating a Plugin

Plugins implement the `BridgePlugin` interface:

```typescript
import type {
  BridgePlugin,
  BridgeSession,
  ModelInfo,
  Message,
  ToolDefinition,
  StreamChunk,
} from '@ai-ide-bridge/core';

export class MyBridgePlugin implements BridgePlugin {
  name = 'my-provider';
  version = '1.0.0';

  async authenticate(config: Record<string, string>): Promise<boolean> {
    // Validate credentials
    return true;
  }

  async listModels(config: Record<string, string>): Promise<ModelInfo[]> {
    // Return available models
    return [];
  }

  async createSession(config: Record<string, string>, model: string): Promise<BridgeSession> {
    // Return a streaming session
    return new MyBridgeSession();
  }
}
```

## Documentation

For full documentation, plugin development guides, and architecture details, please visit the main repository: [https://github.com/aeswibon/llm-bridge](https://github.com/aeswibon/llm-bridge).

## License

MIT
