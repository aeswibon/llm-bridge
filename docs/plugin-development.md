# Plugin Development Guide

## Overview

Plugins are npm packages that implement the `BridgePlugin` interface.

## Interface

```typescript
import type {
  BridgePlugin,
  BridgeSession,
  ModelInfo,
  Message,
  ToolDefinition,
  StreamChunk,
} from '@llm-bridge/core';

class MyPlugin implements BridgePlugin {
  name = 'my-provider';
  version = '1.0.0';

  async authenticate(config: Record<string, string>): Promise<boolean> {
    // Validate API key, return true if valid
  }

  async listModels(config: Record<string, string>): Promise<ModelInfo[]> {
    // Return list of available models
  }

  async createSession(config: Record<string, string>, model: string): Promise<BridgeSession> {
    // Return a session that can stream responses
  }
}
```

## Publishing

Publish to npm with `@llm-bridge/` scope for discoverability.
