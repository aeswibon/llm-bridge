# Plugin Development Guide

## Overview

Plugins are npm packages that implement the `BridgePlugin` interface from `@ai-ide-bridge/core`. There are two patterns: HTTP-based and daemon-based.

## BridgePlugin Interface

```typescript
import type {
  BridgePlugin,
  BridgeSession,
  ModelInfo,
  Message,
  ToolDefinition,
  StreamChunk,
} from '@ai-ide-bridge/core';

interface BridgePlugin {
  name: string;
  version: string;
  authenticate(config: Record<string, string>): Promise<boolean>;
  listModels(config: Record<string, string>): Promise<ModelInfo[]>;
  createSession(config: Record<string, string>, model: string): Promise<BridgeSession>;
}

interface BridgeSession {
  send(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk>;
  dispose(): Promise<void>;
}
```

## StreamChunk Types

```typescript
type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; toolCall: { id: string; name: string; arguments: string } }
  | { type: 'error'; content: string; finishReason: string }
  | { type: 'done'; finishReason: 'stop' | 'tool_calls' | 'length' | 'error' };
```

## HTTP-based Plugin

For providers with a cloud API (Cursor, Copilot):

```typescript
import type {
  BridgePlugin,
  BridgeSession,
  ModelInfo,
  Message,
  ToolDefinition,
  StreamChunk,
} from '@ai-ide-bridge/core';

export class MyHttpPlugin implements BridgePlugin {
  name = 'my-provider';
  version = '1.0.0';

  async authenticate(config: Record<string, string>): Promise<boolean> {
    const token = config.MY_PROVIDER_TOKEN;
    if (!token) return false;
    // Validate token against provider API
    const res = await fetch('https://api.provider.com/validate', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  }

  async listModels(config: Record<string, string>): Promise<ModelInfo[]> {
    const token = config.MY_PROVIDER_TOKEN;
    if (!token) throw new Error('Missing MY_PROVIDER_TOKEN');
    return [
      { id: 'model-1', name: 'Model 1', capabilities: { streaming: true, tools: true } },
      { id: 'model-2', name: 'Model 2', capabilities: { streaming: true, tools: false } },
    ];
  }

  async createSession(config: Record<string, string>, model: string): Promise<BridgeSession> {
    const token = config.MY_PROVIDER_TOKEN;
    if (!token) throw new Error('Missing MY_PROVIDER_TOKEN');
    return new MyHttpSession(token, model);
  }
}

class MyHttpSession implements BridgeSession {
  constructor(
    private token: string,
    private model: string,
  ) {}

  async *send(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk> {
    const response = await fetch('https://api.provider.com/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ model: this.model, messages, stream: true, tools }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { type: 'done', finishReason: 'stop' };
              return;
            }
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { type: 'text', content };
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async dispose(): Promise<void> {}
}
```

## Daemon-based Plugin

For providers with a local binary (Windsurf):

### Step 1: Create DaemonManager

```typescript
import { createDaemonManager, type DaemonManager } from '@ai-ide-bridge/core';

export function createMyDaemon(): DaemonManager {
  return createDaemonManager({
    binaryName: 'my-language-server',
    downloadUrl: 'https://example.com/download/{platform}/{arch}',
    checksum: 'sha256_checksum_here',
    knownPaths: ['/Applications/MyApp.app/Contents/Resources/language_server'],
    envVar: 'MY_LANGUAGE_SERVER_PATH',
  });
}
```

### Step 2: Create Session

```typescript
import { DaemonBridgeSession } from '@ai-ide-bridge/core';
import type { DaemonManager } from '@ai-ide-bridge/core';

export class MyDaemonSession extends DaemonBridgeSession {
  constructor(daemon: DaemonManager, token: string, model: string, cwd: string = process.cwd()) {
    super(daemon, token, model, cwd);
  }
}
```

`DaemonBridgeSession` handles:

- Spawning the daemon process
- Sending JSON-RPC requests over stdin
- Parsing JSON-RPC responses from stdout
- Converting to `StreamChunk` format
- Process cleanup on dispose

### Step 3: Create Plugin

```typescript
import type { BridgePlugin, BridgeSession, ModelInfo } from '@ai-ide-bridge/core';
import { MyDaemonSession } from './session.js';
import { createMyDaemon } from './daemon.js';

export class MyBridgePlugin implements BridgePlugin {
  name = 'my-provider';
  version = '1.0.0';

  async authenticate(config: Record<string, string>): Promise<boolean> {
    const token = config.MY_PROVIDER_TOKEN;
    if (!token) return false;
    // Validate token
    return true;
  }

  async listModels(config: Record<string, string>): Promise<ModelInfo[]> {
    const token = config.MY_PROVIDER_TOKEN;
    if (!token) throw new Error('Missing MY_PROVIDER_TOKEN');
    return [{ id: 'model-1', name: 'Model 1', capabilities: { streaming: true, tools: true } }];
  }

  async createSession(config: Record<string, string>, model: string): Promise<BridgeSession> {
    const token = config.MY_PROVIDER_TOKEN;
    if (!token) throw new Error('Missing MY_PROVIDER_TOKEN');
    const daemon = createMyDaemon();
    return new MyDaemonSession(daemon, token, model);
  }
}
```

## Package Structure

```
packages/my-provider/
├── package.json          # name: @ai-ide-bridge/my-provider
├── tsconfig.json         # extends ../../tsconfig.base.json
├── src/
│   ├── index.ts          # Barrel exports
│   ├── plugin.ts         # BridgePlugin implementation
│   ├── session.ts        # BridgeSession implementation
│   ├── auth.ts           # Token management
│   ├── models.ts         # Model catalog
│   └── daemon.ts         # DaemonManager (if daemon-based)
└── test/
    ├── plugin.test.ts
    ├── session.test.ts
    └── auth.test.ts
```

## package.json

```json
{
  "name": "@ai-ide-bridge/my-provider",
  "version": "2.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@ai-ide-bridge/core": "workspace:*",
    "@ai-ide-bridge/oauth": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "vitest": "^2.0.0"
  }
}
```

## tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

## Testing

Write tests for each module:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyBridgePlugin } from '../src/plugin.js';

describe('MyBridgePlugin', () => {
  let plugin: MyBridgePlugin;

  beforeEach(() => {
    plugin = new MyBridgePlugin();
  });

  it('has correct name and version', () => {
    expect(plugin.name).toBe('my-provider');
    expect(plugin.version).toBe('1.0.0');
  });

  describe('authenticate', () => {
    it('returns true for valid token', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: true } as Response);
      const result = await plugin.authenticate({ MY_PROVIDER_TOKEN: 'valid' });
      expect(result).toBe(true);
    });

    it('returns false for missing token', async () => {
      const result = await plugin.authenticate({});
      expect(result).toBe(false);
    });
  });
});
```

## Registering in CLI

Add the plugin to `cli/src/commands/start.ts`. Multiple plugins can be registered simultaneously:

```typescript
import { CursorPlugin } from '@ai-ide-bridge/cursor';
import { CopilotPlugin } from '@ai-ide-bridge/copilot';
import { WindsurfPlugin } from '@ai-ide-bridge/windsurf';
import { MyBridgePlugin } from '@ai-ide-bridge/my-provider';

// In startCommand():
const plugins = [
  new CursorPlugin(),
  new CopilotPlugin(),
  new WindsurfPlugin(),
  new MyBridgePlugin(),
];

for (const plugin of plugins) {
  server.registerPlugin(plugin);
}

// Set the default plugin for unprefixed model routing
if (config.defaultPlugin || config.activePlugin) {
  server.setDefaultPlugin(config.defaultPlugin ?? config.activePlugin);
}

console.error(`[llm-bridge] registered ${plugins.length} plugins`);
```

## Model Prefixing

When a plugin is registered, its `name` property automatically becomes the model ID prefix. For example:

```typescript
export class MyBridgePlugin implements BridgePlugin {
  name = 'my-provider'; // ← This becomes the prefix
  // ...
}
```

Models from this plugin will be exposed as:

- `my-provider/model-1`
- `my-provider/model-2`

Clients must use the prefixed ID when making requests:

```json
{
  "model": "my-provider/model-1"
}
```

The prefix is stripped before the model ID is passed to the plugin's `createSession()` method, so the plugin only sees `model-1`.

## Publishing

Publish to npm with `@ai-ide-bridge/` scope for discoverability.
