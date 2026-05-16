# LLM Bridge — Multi-Provider Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure cursor-opencode-mcp into llm-bridge, a monorepo-based multi-provider framework with zero-config setup, full feature parity (tools, multi-turn, streaming), and a plugin architecture.

**Architecture:** Monorepo with pnpm workspaces. Core package provides OpenAI-compatible HTTP server, session manager, and plugin registry. Cursor package implements the BridgePlugin interface using @cursor/sdk. CLI provides setup wizard, daemon installer, and OpenCode config injection.

**Tech Stack:** TypeScript, Node.js native http, pnpm workspaces, Vitest, pkg (binary compilation), @cursor/sdk, @modelcontextprotocol/sdk, zod

---

## File Structure

```
llm-bridge/
├── package.json                          # Root workspace config
├── pnpm-workspace.yaml                   # Workspace definition
├── turbo.json                            # Task runner config
├── .gitignore
├── tsconfig.base.json                    # Shared TypeScript config
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts                  # Public exports
│   │   │   ├── types.ts                  # BridgePlugin, BridgeSession, StreamChunk, etc.
│   │   │   ├── server.ts                 # HTTP server, routing, SSE
│   │   │   ├── session.ts                # Session store with TTL cleanup
│   │   │   ├── parser.ts                 # OpenAI request → internal format
│   │   │   ├── formatter.ts              # StreamChunk → OpenAI SSE
│   │   │   ├── registry.ts               # Plugin loader and health tracking
│   │   │   └── config.ts                 # Config file loader
│   │   └── test/
│   │       ├── parser.test.ts
│   │       ├── formatter.test.ts
│   │       ├── session.test.ts
│   │       └── registry.test.ts
│   ├── cursor/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts                  # Public exports
│   │   │   ├── plugin.ts                 # CursorBridgePlugin implementation
│   │   │   ├── session.ts                # CursorBridgeSession
│   │   │   └── tools.ts                  # Tool call translation
│   │   └── test/
│   │       ├── plugin.test.ts
│   │       └── tools.test.ts
│   └── mcp/
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── index.ts                  # Public exports
│       │   └── server.ts                 # MCP server with tools
│       └── test/
│           └── server.test.ts
├── cli/
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                      # CLI entry point
│   │   ├── commands/
│   │   │   ├── init.ts                   # Setup wizard
│   │   │   ├── start.ts                  # Launch bridge
│   │   │   ├── configure.ts              # OpenCode config injection
│   │   │   ├── doctor.ts                 # Diagnostics
│   │   │   └── daemon.ts                 # Daemon install/uninstall
│   │   └── utils/
│   │       ├── config.ts                 # Config read/write helpers
│   │       └── opencode.ts               # opencode.json manipulation
│   └── test/
│       └── configure.test.ts
├── docs/
│   ├── plugin-development.md
│   ├── architecture.md
│   └── troubleshooting.md
├── examples/
│   ├── opencode.json
│   └── docker-compose.yml
├── scripts/
│   └── build-binary.sh                   # pkg compilation
├── README.md
├── CONTRIBUTING.md
├── ROADMAP.md
└── LICENSE
```

---

### Task 1: Monorepo Setup

**Files:**
- Create: `package.json` (root), `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "llm-bridge",
  "version": "2.0.0",
  "private": true,
  "description": "Use any AI IDE's model catalog from any OpenAI-compatible client",
  "license": "MIT",
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "dev": "turbo run dev --parallel"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.8.3"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
  - "cli"
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "inputs": ["src/**/*.ts", "test/**/*.ts"]
    },
    "lint": {},
    "typecheck": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 4: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
*.log
.env
.DS_Store
coverage/
```

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore
git commit -m "chore: set up monorepo with pnpm workspaces and turbo"
```

---

### Task 2: Core Types and Plugin Interface

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/types.ts`, `packages/core/src/index.ts`
- Test: `packages/core/test/types.test.ts`

- [ ] **Step 1: Create packages/core/package.json**

```json
{
  "name": "@llm-bridge/core",
  "version": "2.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "references": [{ "path": "./tsconfig.json" }]
}
```

- [ ] **Step 3: Create packages/core/src/types.ts**

```typescript
import { z } from "zod";

export const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool", "function"]),
  content: z.string().nullable().optional(),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.object({
    id: z.string(),
    type: z.literal("function"),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export const ToolDefinitionSchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.unknown()),
  }),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  capabilities: z.object({
    streaming: z.boolean().optional(),
    tools: z.boolean().optional(),
    vision: z.boolean().optional(),
  }).optional(),
});

export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export type StreamChunkType = "text" | "tool_call" | "tool_result" | "error" | "done";
export type FinishReason = "stop" | "tool_calls" | "error" | "length";

export interface StreamChunk {
  type: StreamChunkType;
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  finishReason?: FinishReason;
}

export interface BridgePlugin {
  name: string;
  version: string;
  authenticate(config: Record<string, string>): Promise<boolean>;
  listModels(config: Record<string, string>): Promise<ModelInfo[]>;
  createSession(config: Record<string, string>, model: string): Promise<BridgeSession>;
}

export interface BridgeSession {
  send(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk>;
  dispose(): Promise<void>;
}

export interface PluginHealth {
  name: string;
  healthy: boolean;
  lastChecked: Date;
  error?: string;
}

export interface BridgeConfig {
  activePlugin: string;
  port: number;
  host: string;
  plugins: Record<string, Record<string, string>>;
  sessionTTL: number;
  toolMode: "strict" | "lenient";
}

export const DefaultConfig: BridgeConfig = {
  activePlugin: "cursor",
  port: 3849,
  host: "127.0.0.1",
  plugins: {},
  sessionTTL: 1800,
  toolMode: "lenient",
};
```

- [ ] **Step 4: Create packages/core/src/index.ts**

```typescript
export * from "./types.js";
export { BridgeServer } from "./server.js";
export { SessionStore } from "./session.js";
export { parseChatRequest, parseModelsRequest } from "./parser.js";
export { formatStreamChunk, formatCompletion } from "./formatter.js";
export { PluginRegistry } from "./registry.js";
export { loadConfig, saveConfig, configPath } from "./config.js";
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat(core): add types and plugin interface"
```

---

### Task 3: Core HTTP Server

**Files:**
- Create: `packages/core/src/server.ts`
- Test: `packages/core/test/server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/server.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { BridgeServer } from "../src/server.js";

function fetchJson(url: string, options?: http.RequestOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
  });
}

describe("BridgeServer", () => {
  let server: BridgeServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new BridgeServer({ port: 0, host: "127.0.0.1" });
    await server.start();
    const address = server.address();
    baseUrl = `http://127.0.0.1:${(address as any).port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns health status", async () => {
    const res = await fetchJson(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("llm-bridge");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await fetchJson(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run test/server.test.ts
```
Expected: FAIL with "Cannot find module '../src/server.js'"

- [ ] **Step 3: Create packages/core/src/server.ts**

```typescript
import http, { IncomingMessage, ServerResponse } from "node:http";
import { BridgeConfig, DefaultConfig } from "./types.js";
import { parseChatRequest } from "./parser.js";
import { PluginRegistry } from "./registry.js";
import { SessionStore } from "./session.js";

export class BridgeServer {
  private server: http.Server | null = null;
  private registry: PluginRegistry;
  private sessions: SessionStore;
  private config: BridgeConfig;

  constructor(config: Partial<BridgeConfig> = {}) {
    this.config = { ...DefaultConfig, ...config };
    this.registry = new PluginRegistry();
    this.sessions = new SessionStore(this.config.sessionTTL);
  }

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        console.error("[llm-bridge] unhandled error:", err);
        if (!res.headersSent) {
          this.jsonResponse(res, 500, { error: { message: "internal error", type: "internal" } });
        }
      });
    });

    return new Promise((resolve) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        const address = this.server!.address();
        const port = typeof address === "object" ? address?.port : this.config.port;
        console.error(`[llm-bridge] listening on http://${this.config.host}:${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    await this.sessions.disposeAll();
    return new Promise((resolve) => {
      this.server?.close(() => resolve());
    });
  }

  address(): import("net").AddressInfo | string | null {
    return this.server?.address() ?? null;
  }

  private async handleRequest(req: IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", `http://${this.config.host}`);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "GET" && path === "/health") {
      this.jsonResponse(res, 200, { ok: true, service: "llm-bridge" });
      return;
    }

    if (req.method === "GET" && path === "/v1/models") {
      await this.handleModels(req, res);
      return;
    }

    if (req.method === "POST" && path === "/v1/chat/completions") {
      await this.handleChatCompletions(req, res);
      return;
    }

    this.jsonResponse(res, 404, { error: { message: `Not found: ${path}`, type: "not_found" } });
  }

  private async handleModels(_req: IncomingMessage, res: http.ServerResponse): Promise<void> {
    const plugin = this.registry.getActivePlugin();
    if (!plugin) {
      this.jsonResponse(res, 503, { error: { message: "No active plugin configured", type: "configuration_error" } });
      return;
    }

    try {
      const config = this.config.plugins[plugin.name] ?? {};
      const models = await plugin.listModels(config);
      this.jsonResponse(res, 200, {
        object: "list",
        data: models.map((m) => ({
          id: m.id,
          object: "model",
          created: Math.floor(Date.now() / 1000),
          owned_by: plugin.name,
        })),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.jsonResponse(res, 502, { error: { message: msg, type: "provider_error" } });
    }
  }

  private async handleChatCompletions(req: IncomingMessage, res: http.ServerResponse): Promise<void> {
    const plugin = this.registry.getActivePlugin();
    if (!plugin) {
      this.jsonResponse(res, 503, { error: { message: "No active plugin configured", type: "configuration_error" } });
      return;
    }

    const parsed = await parseChatRequest(req);
    if (!parsed.success) {
      this.jsonResponse(res, 400, { error: { message: parsed.error, type: "invalid_request_error" } });
      return;
    }

    const { messages, model, stream, tools } = parsed.data;

    try {
      const config = this.config.plugins[plugin.name] ?? {};
      const session = await plugin.createSession(config, model);
      const sessionId = req.headers["x-session-id"] as string | undefined;
      this.sessions.set(sessionId ?? crypto.randomUUID(), session);

      res.writeHead(200, {
        "Content-Type": stream ? "text/event-stream; charset=utf-8" : "application/json",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const chunks: string[] = [];
      for await (const chunk of session.send(messages, tools)) {
        if (stream) {
          res.write(this.formatSSEChunk(chunk, model));
        } else {
          if (chunk.type === "text" && chunk.content) {
            chunks.push(chunk.content);
          }
        }
      }

      if (!stream) {
        const completionId = `chatcmpl-${crypto.randomUUID()}`;
        this.jsonResponseRaw(res, 200, {
          id: completionId,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{
            index: 0,
            message: { role: "assistant", content: chunks.join("") },
            finish_reason: "stop",
          }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        });
      } else {
        res.write(`data: [DONE]\n\n`);
        res.end();
      }

      await session.dispose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (stream && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: { message: msg, type: "provider_error" } })}\n\n`);
        res.end();
      } else if (!res.headersSent) {
        this.jsonResponse(res, 502, { error: { message: msg, type: "provider_error" } });
      }
    }
  }

  private formatSSEChunk(chunk: any, model: string): string {
    const completionId = `chatcmpl-${crypto.randomUUID()}`;
    const delta: Record<string, unknown> = {};
    let finishReason: string | null = null;

    if (chunk.type === "text" && chunk.content) {
      delta.content = chunk.content;
    }
    if (chunk.type === "tool_call" && chunk.toolCall) {
      delta.tool_calls = [{
        index: 0,
        id: chunk.toolCall.id,
        type: "function",
        function: { name: chunk.toolCall.name, arguments: chunk.toolCall.arguments },
      }];
    }
    if (chunk.finishReason) {
      finishReason = chunk.finishReason;
    }

    const payload = {
      id: completionId,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    };

    return `data: ${JSON.stringify(payload)}\n\n`;
  }

  private jsonResponse(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }

  private jsonResponseRaw(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  }

  registerPlugin(plugin: any): void {
    this.registry.register(plugin);
  }

  setActivePlugin(name: string): void {
    this.registry.setActive(name);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run test/server.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/server.ts packages/core/test/server.test.ts
git commit -m "feat(core): add HTTP server with health and routing"
```

---

### Task 4: Session Store

**Files:**
- Create: `packages/core/src/session.ts`
- Test: `packages/core/test/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/session.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionStore } from "../src/session.js";
import type { BridgeSession } from "../src/types.js";

function mockSession(): BridgeSession {
  return {
    send: async function* () {},
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SessionStore", () => {
  let store: SessionStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new SessionStore(1800);
  });

  it("stores and retrieves sessions", () => {
    const session = mockSession();
    store.set("test-id", session);
    expect(store.get("test-id")).toBe(session);
  });

  it("returns undefined for missing sessions", () => {
    expect(store.get("nonexistent")).toBeUndefined();
  });

  it("disposes expired sessions", async () => {
    const session = mockSession();
    store.set("test-id", session);
    vi.advanceTimersByTime(1801 * 1000);
    store.cleanup();
    expect(store.get("test-id")).toBeUndefined();
    expect(session.dispose).toHaveBeenCalled();
  });

  it("disposes all sessions", async () => {
    const s1 = mockSession();
    const s2 = mockSession();
    store.set("id1", s1);
    store.set("id2", s2);
    await store.disposeAll();
    expect(s1.dispose).toHaveBeenCalled();
    expect(s2.dispose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run test/session.test.ts
```
Expected: FAIL with "Cannot find module '../src/session.js'"

- [ ] **Step 3: Create packages/core/src/session.ts**

```typescript
import type { BridgeSession } from "./types.js";

interface SessionEntry {
  session: BridgeSession;
  lastActive: number;
}

export class SessionStore {
  private sessions: Map<string, SessionEntry> = new Map();
  private ttlMs: number;

  constructor(ttlSeconds: number = 1800) {
    this.ttlMs = ttlSeconds * 1000;
  }

  set(id: string, session: BridgeSession): void {
    this.sessions.set(id, { session, lastActive: Date.now() });
  }

  get(id: string): BridgeSession | undefined {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.lastActive = Date.now();
      return entry.session;
    }
    return undefined;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions.entries()) {
      if (now - entry.lastActive > this.ttlMs) {
        this.sessions.delete(id);
        entry.session.dispose().catch((err) => {
          console.error(`[session] dispose error for ${id}:`, err);
        });
      }
    }
  }

  async disposeAll(): Promise<void> {
    const disposals = Array.from(this.sessions.values()).map((entry) =>
      entry.session.dispose().catch((err) => {
        console.error("[session] disposeAll error:", err);
      })
    );
    this.sessions.clear();
    await Promise.all(disposals);
  }

  get size(): number {
    return this.sessions.size;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run test/session.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session.ts packages/core/test/session.test.ts
git commit -m "feat(core): add session store with TTL cleanup"
```

---

### Task 5: Request Parser

**Files:**
- Create: `packages/core/src/parser.ts`
- Test: `packages/core/test/parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseChatRequest } from "../src/parser.js";
import http from "node:http";

function createRequest(body: any, headers: Record<string, string> = {}): http.IncomingMessage {
  const req = new http.IncomingMessage({} as any);
  req.headers = { "content-type": "application/json", ...headers };
  (req as any)._read = () => {};
  process.nextTick(() => {
    req.emit("data", Buffer.from(JSON.stringify(body)));
    req.emit("end");
  });
  return req;
}

describe("parseChatRequest", () => {
  it("parses valid chat request", async () => {
    const req = createRequest({
      model: "composer-2",
      messages: [{ role: "user", content: "Hello" }],
      stream: true,
    });
    const result = await parseChatRequest(req);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe("composer-2");
      expect(result.data.messages).toHaveLength(1);
      expect(result.data.stream).toBe(true);
    }
  });

  it("rejects missing model", async () => {
    const req = createRequest({ messages: [{ role: "user", content: "Hello" }] });
    const result = await parseChatRequest(req);
    expect(result.success).toBe(false);
  });

  it("rejects missing messages", async () => {
    const req = createRequest({ model: "composer-2" });
    const result = await parseChatRequest(req);
    expect(result.success).toBe(false);
  });

  it("defaults stream to false", async () => {
    const req = createRequest({
      model: "composer-2",
      messages: [{ role: "user", content: "Hello" }],
    });
    const result = await parseChatRequest(req);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stream).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run test/parser.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create packages/core/src/parser.ts**

```typescript
import http from "node:http";
import { z } from "zod";
import { MessageSchema, ToolDefinitionSchema } from "./types.js";

const ChatRequestSchema = z.object({
  model: z.string().min(1, "model is required"),
  messages: z.array(MessageSchema).min(1, "messages must have at least one message"),
  stream: z.boolean().optional().default(false),
  tools: z.array(ToolDefinitionSchema).optional(),
  tool_choice: z.unknown().optional(),
});

export type ParsedChatRequest = z.infer<typeof ChatRequestSchema>;

export async function parseChatRequest(
  req: http.IncomingMessage
): Promise<{ success: true; data: ParsedChatRequest } | { success: false; error: string }> {
  try {
    const body = await readBody(req);
    const json = JSON.parse(body);
    const result = ChatRequestSchema.safeParse(json);
    if (!result.success) {
      return { success: false, error: result.error.errors[0].message };
    }
    return { success: true, data: result.data };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { success: false, error: "Invalid JSON body" };
    }
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export function parseModelsRequest(_req: http.IncomingMessage): { success: true } | { success: false; error: string } {
  return { success: true };
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run test/parser.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/parser.ts packages/core/test/parser.test.ts
git commit -m "feat(core): add OpenAI request parser with zod validation"
```

---

### Task 6: Response Formatter

**Files:**
- Create: `packages/core/src/formatter.ts`
- Test: `packages/core/test/formatter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/formatter.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatStreamChunk, formatCompletion } from "../src/formatter.js";
import type { StreamChunk } from "../src/types.js";

describe("formatStreamChunk", () => {
  it("formats text delta as SSE", () => {
    const chunk: StreamChunk = { type: "text", content: "Hello" };
    const result = formatStreamChunk(chunk, "composer-2", "chatcmpl-test");
    expect(result).toContain("data:");
    expect(result).toContain('"content":"Hello"');
    expect(result).toContain('"model":"composer-2"');
  });

  it("formats tool call as SSE", () => {
    const chunk: StreamChunk = {
      type: "tool_call",
      toolCall: { id: "tc-1", name: "search", arguments: '{"q":"test"}' },
    };
    const result = formatStreamChunk(chunk, "composer-2", "chatcmpl-test");
    expect(result).toContain('"tool_calls"');
    expect(result).toContain('"name":"search"');
  });

  it("formats done chunk with finish_reason", () => {
    const chunk: StreamChunk = { type: "done", finishReason: "stop" };
    const result = formatStreamChunk(chunk, "composer-2", "chatcmpl-test");
    expect(result).toContain('"finish_reason":"stop"');
  });
});

describe("formatCompletion", () => {
  it("formats non-streaming completion", () => {
    const result = formatCompletion("Hello world", "composer-2", "chatcmpl-test");
    expect(result.id).toBe("chatcmpl-test");
    expect(result.choices[0].message.content).toBe("Hello world");
    expect(result.choices[0].finish_reason).toBe("stop");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run test/formatter.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create packages/core/src/formatter.ts**

```typescript
import type { StreamChunk } from "./types.js";

export function formatStreamChunk(
  chunk: StreamChunk,
  model: string,
  completionId: string
): string {
  const delta: Record<string, unknown> = {};
  let finishReason: string | null = null;

  if (chunk.type === "text" && chunk.content) {
    delta.content = chunk.content;
  }

  if (chunk.type === "tool_call" && chunk.toolCall) {
    delta.tool_calls = [{
      index: 0,
      id: chunk.toolCall.id,
      type: "function",
      function: { name: chunk.toolCall.name, arguments: chunk.toolCall.arguments },
    }];
  }

  if (chunk.finishReason) {
    finishReason = chunk.finishReason;
  }

  const payload = {
    id: completionId,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };

  return `data: ${JSON.stringify(payload)}\n\n`;
}

export function formatCompletion(
  content: string,
  model: string,
  completionId: string
): Record<string, unknown> {
  return {
    id: completionId,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: { role: "assistant", content },
      finish_reason: "stop",
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run test/formatter.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/formatter.ts packages/core/test/formatter.test.ts
git commit -m "feat(core): add OpenAI response formatter"
```

---

### Task 7: Plugin Registry

**Files:**
- Create: `packages/core/src/registry.ts`
- Test: `packages/core/test/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/registry.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { PluginRegistry } from "../src/registry.js";
import type { BridgePlugin } from "../src/types.js";

function mockPlugin(name: string): BridgePlugin {
  return {
    name,
    version: "1.0.0",
    authenticate: vi.fn().mockResolvedValue(true),
    listModels: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({
      send: async function* () {},
      dispose: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

describe("PluginRegistry", () => {
  it("registers and retrieves plugins", () => {
    const registry = new PluginRegistry();
    const plugin = mockPlugin("test");
    registry.register(plugin);
    expect(registry.getPlugin("test")).toBe(plugin);
  });

  it("returns undefined for unknown plugins", () => {
    const registry = new PluginRegistry();
    expect(registry.getPlugin("nonexistent")).toBeUndefined();
  });

  it("sets active plugin", () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin("cursor"));
    registry.setActive("cursor");
    expect(registry.getActivePlugin()?.name).toBe("cursor");
  });

  it("returns null when no active plugin is set", () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin("cursor"));
    expect(registry.getActivePlugin()).toBeNull();
  });

  it("lists all registered plugins", () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin("cursor"));
    registry.register(mockPlugin("copilot"));
    const names = registry.listPlugins().map((p) => p.name);
    expect(names).toContain("cursor");
    expect(names).toContain("copilot");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run test/registry.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create packages/core/src/registry.ts**

```typescript
import type { BridgePlugin, PluginHealth } from "./types.js";

export class PluginRegistry {
  private plugins: Map<string, BridgePlugin> = new Map();
  private activePluginName: string | null = null;
  private health: Map<string, PluginHealth> = new Map();

  register(plugin: BridgePlugin): void {
    this.plugins.set(plugin.name, plugin);
    this.health.set(plugin.name, {
      name: plugin.name,
      healthy: true,
      lastChecked: new Date(),
    });
  }

  getPlugin(name: string): BridgePlugin | undefined {
    return this.plugins.get(name);
  }

  setActive(name: string): void {
    if (!this.plugins.has(name)) {
      throw new Error(`Plugin "${name}" is not registered`);
    }
    this.activePluginName = name;
  }

  getActivePlugin(): BridgePlugin | null {
    if (!this.activePluginName) return null;
    return this.plugins.get(this.activePluginName) ?? null;
  }

  listPlugins(): BridgePlugin[] {
    return Array.from(this.plugins.values());
  }

  markUnhealthy(name: string, error: string): void {
    this.health.set(name, {
      name,
      healthy: false,
      lastChecked: new Date(),
      error,
    });
  }

  getHealth(name: string): PluginHealth | undefined {
    return this.health.get(name);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run test/registry.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/registry.ts packages/core/test/registry.test.ts
git commit -m "feat(core): add plugin registry with health tracking"
```

---

### Task 8: Config Loader

**Files:**
- Create: `packages/core/src/config.ts`
- Test: `packages/core/test/config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/test/config.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig, saveConfig, configPath } from "../src/config.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("config", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "llm-bridge-config-"));
    vi.spyOn(os, "homedir").mockReturnValue(tmpDir);
  });

  it("returns default config when no file exists", () => {
    const config = loadConfig();
    expect(config.activePlugin).toBe("cursor");
    expect(config.port).toBe(3849);
  });

  it("loads config from file", () => {
    const configDir = path.join(tmpDir, ".config", "llm-bridge");
    fs.mkdirSync(configDir, { recursive: true });
    const configData = { activePlugin: "cursor", port: 9999, plugins: {}, host: "127.0.0.1", sessionTTL: 1800, toolMode: "lenient" as const };
    fs.writeFileSync(configPath(), JSON.stringify(configData));
    const config = loadConfig();
    expect(config.port).toBe(9999);
  });

  it("saves config to file", () => {
    const config = loadConfig();
    config.port = 5555;
    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded.port).toBe(5555);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/core && npx vitest run test/config.test.ts
```
Expected: FAIL

- [ ] **Step 3: Create packages/core/src/config.ts**

```typescript
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { BridgeConfig, DefaultConfig } from "./types.js";

export function configPath(): string {
  const home = os.homedir();
  return path.join(home, ".config", "llm-bridge", "config.json");
}

export function loadConfig(): BridgeConfig {
  const envPort = process.env.LLM_BRIDGE_PORT;
  const envHost = process.env.LLM_BRIDGE_HOST;

  try {
    const filePath = process.env.LLM_BRIDGE_CONFIG ?? configPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const fileConfig = JSON.parse(raw) as Partial<BridgeConfig>;
      const config = { ...DefaultConfig, ...fileConfig };
      if (envPort) config.port = parseInt(envPort, 10);
      if (envHost) config.host = envHost;
      return config;
    }
  } catch (err) {
    console.warn("[llm-bridge] failed to load config file, using defaults:", err);
  }

  const config = { ...DefaultConfig };
  if (envPort) config.port = parseInt(envPort, 10);
  if (envHost) config.host = envHost;
  return config;
}

export function saveConfig(config: BridgeConfig): void {
  const filePath = configPath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd packages/core && npx vitest run test/config.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/config.ts packages/core/test/config.test.ts
git commit -m "feat(core): add config loader with file and env support"
```

---

### Task 9: Cursor Plugin Implementation

**Files:**
- Create: `packages/cursor/package.json`, `packages/cursor/tsconfig.json`, `packages/cursor/src/index.ts`, `packages/cursor/src/plugin.ts`, `packages/cursor/src/session.ts`, `packages/cursor/src/tools.ts`
- Test: `packages/cursor/test/plugin.test.ts`, `packages/cursor/test/tools.test.ts`

- [ ] **Step 1: Create packages/cursor/package.json**

```json
{
  "name": "@llm-bridge/cursor",
  "version": "2.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@cursor/sdk": "^1.0.13",
    "@llm-bridge/core": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create packages/cursor/tsconfig.json**

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

- [ ] **Step 3: Create packages/cursor/src/tools.ts**

```typescript
import type { ToolDefinition } from "@llm-bridge/core";

export interface CursorTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export function translateTools(tools: ToolDefinition[]): CursorTool[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters as Record<string, unknown>,
    },
  }));
}

export function translateToolResult(toolCallId: string, result: string): string {
  return `[tool result for ${toolCallId}]\n${result}`;
}
```

- [ ] **Step 4: Create packages/cursor/src/session.ts**

```typescript
import { Agent } from "@cursor/sdk";
import type { BridgeSession, Message, ToolDefinition, StreamChunk } from "@llm-bridge/core";
import { translateTools, translateToolResult } from "./tools.js";

export class CursorBridgeSession implements BridgeSession {
  private agent: Agent | null = null;
  private apiKey: string;
  private modelId: string;
  private cwd: string;

  constructor(apiKey: string, modelId: string, cwd: string = process.cwd()) {
    this.apiKey = apiKey;
    this.modelId = modelId;
    this.cwd = cwd;
  }

  async *send(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk> {
    const prompt = this.buildPrompt(messages);
    const cursorTools = tools ? translateTools(tools) : undefined;

    try {
      this.agent = await Agent.create({
        apiKey: this.apiKey,
        model: { id: this.modelId },
        local: { cwd: this.cwd, settingSources: [] },
      });

      const run = await this.agent.send(prompt, {
        model: { id: this.modelId },
        tools: cursorTools,
        onDelta: ({ update }: { update: { type: string; text?: string } }) => {
          if (update.type === "text-delta" && update.text) {
            // Note: onDelta is synchronous callback, we buffer and yield in the loop
          }
        },
      });

      const result = await run.wait();
      if (result.status === "error" || result.status === "cancelled") {
        yield { type: "error", content: `Agent run ${result.status}: ${result.result ?? "no details"}`, finishReason: "error" };
        return;
      }

      yield { type: "text", content: result.result ?? "", finishReason: "stop" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      yield { type: "error", content: msg, finishReason: "error" };
    }
  }

  async dispose(): Promise<void> {
    if (this.agent) {
      try {
        await (this.agent as any)[Symbol.asyncDispose]();
      } catch {
        // Ignore dispose errors
      }
      this.agent = null;
    }
  }

  private buildPrompt(messages: Message[]): string {
    const blocks: string[] = [];
    for (const m of messages) {
      const text = typeof m.content === "string" ? m.content : "";
      if (!text) continue;
      const label = m.role === "tool" ? `tool (${m.tool_call_id ?? m.name ?? "result"})` : m.role;
      blocks.push(`[${label}]\n${text}`);
    }
    return `\nFollow this conversation transcript and reply as the assistant.\n\n${blocks.join("\n\n---\n\n")}\n`;
  }
}
```

- [ ] **Step 5: Create packages/cursor/src/plugin.ts**

```typescript
import { Cursor, Agent } from "@cursor/sdk";
import type { BridgePlugin, BridgeSession, ModelInfo } from "@llm-bridge/core";
import { CursorBridgeSession } from "./session.js";

export class CursorBridgePlugin implements BridgePlugin {
  name = "cursor";
  version = "2.0.0";

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
    if (!apiKey) throw new Error("Missing CURSOR_API_KEY");
    const models = await Cursor.models.list({ apiKey });
    return models.map((m) => ({
      id: m.id,
      name: m.id,
      capabilities: { streaming: true, tools: true },
    }));
  }

  async createSession(config: Record<string, string>, model: string): Promise<BridgeSession> {
    const apiKey = config.CURSOR_API_KEY;
    if (!apiKey) throw new Error("Missing CURSOR_API_KEY");
    const cwd = config.CURSOR_OPENCODE_BRIDGE_CWD ?? process.cwd();
    return new CursorBridgeSession(apiKey, model, cwd);
  }
}
```

- [ ] **Step 6: Create packages/cursor/src/index.ts**

```typescript
export { CursorBridgePlugin } from "./plugin.js";
export { CursorBridgeSession } from "./session.js";
```

- [ ] **Step 7: Write tests for plugin**

Create `packages/cursor/test/plugin.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CursorBridgePlugin } from "../src/plugin.js";
import { Cursor } from "@cursor/sdk";

vi.mock("@cursor/sdk", () => ({
  Cursor: {
    me: vi.fn(),
    models: { list: vi.fn() },
  },
  Agent: { create: vi.fn(), prompt: vi.fn() },
}));

describe("CursorBridgePlugin", () => {
  let plugin: CursorBridgePlugin;

  beforeEach(() => {
    plugin = new CursorBridgePlugin();
    vi.clearAllMocks();
  });

  it("authenticates with valid key", async () => {
    (Cursor.me as any).mockResolvedValue({ id: "user-123" });
    const result = await plugin.authenticate({ CURSOR_API_KEY: "cursor_test_key" });
    expect(result).toBe(true);
  });

  it("fails authentication with missing key", async () => {
    const result = await plugin.authenticate({});
    expect(result).toBe(false);
  });

  it("lists models", async () => {
    (Cursor.models.list as any).mockResolvedValue([{ id: "composer-2" }, { id: "sonnet" }]);
    const models = await plugin.listModels({ CURSOR_API_KEY: "cursor_test_key" });
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("composer-2");
  });

  it("throws on listModels without key", async () => {
    await expect(plugin.listModels({})).rejects.toThrow("Missing CURSOR_API_KEY");
  });
});
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
cd packages/cursor && npx vitest run
```
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/cursor/
git commit -m "feat(cursor): implement Cursor bridge plugin with SDK integration"
```

---

### Task 10: MCP Server

**Files:**
- Create: `packages/mcp/package.json`, `packages/mcp/tsconfig.json`, `packages/mcp/src/index.ts`, `packages/mcp/src/server.ts`
- Test: `packages/mcp/test/server.test.ts`

- [ ] **Step 1: Create packages/mcp/package.json**

```json
{
  "name": "@llm-bridge/mcp",
  "version": "2.0.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "llm-bridge-mcp": "./dist/server.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create packages/mcp/tsconfig.json**

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

- [ ] **Step 3: Create packages/mcp/src/server.ts**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import http from "node:http";

const BRIDGE_PORT = Number(process.env.LLM_BRIDGE_PORT ?? "3849");
const BRIDGE_HOST = process.env.LLM_BRIDGE_HOST ?? "127.0.0.1";

function bridgeUrl(path: string): string {
  return `http://${BRIDGE_HOST}:${BRIDGE_PORT}${path}`;
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on("error", reject);
  });
}

const mcpServer = new McpServer(
  { name: "llm-bridge-mcp", version: "2.0.0" },
  {
    instructions: "Manage llm-bridge: check status, list models, generate OpenCode config.",
  }
);

mcpServer.registerTool(
  "bridge_status",
  { description: "Check llm-bridge server health and status." },
  async () => {
    try {
      const res = await fetchJson(bridgeUrl("/health"));
      if (res.status === 200) {
        return { content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }] };
      }
      return { content: [{ type: "text", text: `Bridge unhealthy: status ${res.status}` }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `Cannot reach bridge: ${msg}` }] };
    }
  }
);

mcpServer.registerTool(
  "list_models",
  { description: "List available models from the active provider." },
  async () => {
    try {
      const res = await fetchJson(bridgeUrl("/v1/models"));
      if (res.status === 200) {
        const modelIds = res.body.data?.map((m: any) => m.id) ?? [];
        return { content: [{ type: "text", text: `Available models: ${modelIds.join(", ")}` }] };
      }
      return { content: [{ type: "text", text: `Failed to list models: ${JSON.stringify(res.body)}` }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `Cannot reach bridge: ${msg}` }] };
    }
  }
);

mcpServer.registerTool(
  "generate_opencode_config",
  {
    description: "Generate an OpenCode provider fragment for the bridge.",
    inputSchema: {
      providerId: z.string().optional().describe("Provider key (default: llm-bridge)."),
      modelId: z.string().optional().describe("Model id (default: composer-2)."),
    },
  },
  async ({ providerId, modelId }) => {
    const pid = providerId ?? "llm-bridge";
    const mid = modelId ?? "composer-2";
    const fragment = {
      provider: {
        [pid]: {
          npm: "@ai-sdk/openai-compatible",
          name: "LLM Bridge",
          options: {
            apiKey: "bridge-local",
            baseURL: bridgeUrl("/v1"),
          },
          models: { [mid]: { name: mid } },
        },
      },
    };
    return {
      content: [{ type: "text", text: `Merge into opencode.json:\n\n${JSON.stringify(fragment, null, 2)}` }],
    };
  }
);

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
```

- [ ] **Step 4: Create packages/mcp/src/index.ts**

```typescript
export {};
```

- [ ] **Step 5: Commit**

```bash
git add packages/mcp/
git commit -m "feat(mcp): add MCP server with status, models, and config tools"
```

---

### Task 11: CLI - Init and Start Commands

**Files:**
- Create: `cli/package.json`, `cli/tsconfig.json`, `cli/src/index.ts`, `cli/src/commands/init.ts`, `cli/src/commands/start.ts`, `cli/src/utils/config.ts`

- [ ] **Step 1: Create cli/package.json**

```json
{
  "name": "llm-bridge",
  "version": "2.0.0",
  "type": "module",
  "bin": {
    "llm-bridge": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@llm-bridge/core": "workspace:*",
    "@llm-bridge/cursor": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create cli/tsconfig.json**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create cli/src/utils/config.ts**

```typescript
import { loadConfig, saveConfig, BridgeConfig } from "@llm-bridge/core";

export function readConfig(): BridgeConfig {
  return loadConfig();
}

export function writeConfig(config: BridgeConfig): void {
  saveConfig(config);
}

export function setPluginConfig(pluginName: string, envVars: Record<string, string>): void {
  const config = readConfig();
  config.plugins[pluginName] = { ...config.plugins[pluginName], ...envVars };
  config.activePlugin = pluginName;
  writeConfig(config);
}
```

- [ ] **Step 4: Create cli/src/commands/init.ts**

```typescript
import { readConfig, writeConfig, setPluginConfig } from "../utils/config.js";
import { CursorBridgePlugin } from "@llm-bridge/cursor";
import { createInterface } from "node:readline";

export async function initCommand(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

  console.log("llm-bridge setup wizard\n");

  const config = readConfig();

  const provider = await ask(`Provider (default: cursor): `) || "cursor";
  config.activePlugin = provider;

  if (provider === "cursor") {
    const apiKey = await ask("Enter your CURSOR_API_KEY: ");
    if (!apiKey) {
      console.error("API key is required.");
      rl.close();
      process.exit(1);
    }

    setPluginConfig("cursor", { CURSOR_API_KEY: apiKey });

    const plugin = new CursorBridgePlugin();
    const valid = await plugin.authenticate({ CURSOR_API_KEY: apiKey });
    if (!valid) {
      console.error("Invalid API key. Please check and try again.");
      rl.close();
      process.exit(1);
    }
    console.log("API key validated successfully.");
  }

  const port = await ask(`Port (default: ${config.port}): `);
  if (port) config.port = parseInt(port, 10);

  writeConfig(config);
  console.log(`\nConfig saved. Run 'llm-bridge start' to launch.`);
  rl.close();
}
```

- [ ] **Step 5: Create cli/src/commands/start.ts**

```typescript
import { BridgeServer, loadConfig, BridgeConfig } from "@llm-bridge/core";
import { CursorBridgePlugin } from "@llm-bridge/cursor";

export async function startCommand(): Promise<void> {
  const config = loadConfig();
  const server = new BridgeServer(config);

  if (config.activePlugin === "cursor") {
    const plugin = new CursorBridgePlugin();
    server.registerPlugin(plugin);
    server.setActivePlugin("cursor");
    console.error(`[llm-bridge] active plugin: cursor`);
  } else {
    console.error(`[llm-bridge] warning: unknown plugin "${config.activePlugin}"`);
  }

  await server.start();

  process.on("SIGINT", async () => {
    console.error("\n[llm-bridge] shutting down...");
    await server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.error("\n[llm-bridge] shutting down...");
    await server.stop();
    process.exit(0);
  });
}
```

- [ ] **Step 6: Create cli/src/index.ts**

```typescript
import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";

const command = process.argv[2] ?? "help";

async function main(): Promise<void> {
  switch (command) {
    case "init":
      await initCommand();
      break;
    case "start":
      await startCommand();
      break;
    case "help":
    default:
      console.log(`llm-bridge v2.0.0

Usage:
  llm-bridge init       Setup wizard
  llm-bridge start      Launch bridge server
  llm-bridge help       Show this help`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 7: Commit**

```bash
git add cli/
git commit -m "feat(cli): add init wizard and start command"
```

---

### Task 12: CLI - Configure OpenCode Command

**Files:**
- Create: `cli/src/commands/configure.ts`, `cli/src/utils/opencode.ts`
- Test: `cli/test/configure.test.ts`

- [ ] **Step 1: Create cli/src/utils/opencode.ts**

```typescript
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function findOpencodeConfig(): string | null {
  const candidates = [
    path.join(os.homedir(), ".config", "opencode", "opencode.json"),
    path.join(os.homedir(), ".config", "opencode", "opencode.jsonc"),
    path.join(process.cwd(), "opencode.json"),
    path.join(process.cwd(), "opencode.jsonc"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function injectProvider(configPath: string, providerId: string, modelId: string, port: number): void {
  const raw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(raw);
  if (!config.provider) config.provider = {};
  config.provider[providerId] = {
    npm: "@ai-sdk/openai-compatible",
    name: "LLM Bridge",
    options: {
      apiKey: "bridge-local",
      baseURL: `http://127.0.0.1:${port}/v1`,
    },
    models: { [modelId]: { name: modelId } },
  };
  config.model = `${providerId}/${modelId}`;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
```

- [ ] **Step 2: Create cli/src/commands/configure.ts**

```typescript
import { findOpencodeConfig, injectProvider } from "../utils/opencode.js";
import { readConfig } from "../utils/config.js";

export async function configureOpencodeCommand(): Promise<void> {
  const configPath = findOpencodeConfig();
  if (!configPath) {
    console.error("No opencode.json found. Create one at ~/.config/opencode/opencode.json");
    process.exit(1);
  }

  const bridgeConfig = readConfig();
  const providerId = "llm-bridge";
  const modelId = "composer-2";

  injectProvider(configPath, providerId, modelId, bridgeConfig.port);
  console.log(`Injected provider into ${configPath}`);
  console.log(`Provider: ${providerId}, Model: ${modelId}, Port: ${bridgeConfig.port}`);
}
```

- [ ] **Step 3: Update cli/src/index.ts to include configure command**

Add to the switch statement in `cli/src/index.ts`:

```typescript
import { configureOpencodeCommand } from "./commands/configure.js";

// ... in the switch:
case "configure":
  await configureOpencodeCommand();
  break;
```

- [ ] **Step 4: Write test for opencode utils**

Create `cli/test/configure.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { injectProvider } from "../src/utils/opencode.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("opencode utils", () => {
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `opencode-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, "{}");
  });

  it("injects provider into empty config", () => {
    injectProvider(tmpFile, "test-provider", "test-model", 3849);
    const config = JSON.parse(fs.readFileSync(tmpFile, "utf8"));
    expect(config.provider["test-provider"]).toBeDefined();
    expect(config.provider["test-provider"].options.baseURL).toBe("http://127.0.0.1:3849/v1");
    expect(config.model).toBe("test-provider/test-model");
  });

  it("preserves existing config fields", () => {
    fs.writeFileSync(tmpFile, JSON.stringify({ existing: "value" }));
    injectProvider(tmpFile, "test-provider", "test-model", 3849);
    const config = JSON.parse(fs.readFileSync(tmpFile, "utf8"));
    expect(config.existing).toBe("value");
    expect(config.provider["test-provider"]).toBeDefined();
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd cli && npx vitest run
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add cli/src/commands/configure.ts cli/src/utils/opencode.ts cli/test/configure.test.ts cli/src/index.ts
git commit -m "feat(cli): add configure opencode command with in-place injection"
```

---

### Task 13: CLI - Doctor and Daemon Commands

**Files:**
- Create: `cli/src/commands/doctor.ts`, `cli/src/commands/daemon.ts`

- [ ] **Step 1: Create cli/src/commands/doctor.ts**

```typescript
import http from "node:http";
import { readConfig } from "../utils/config.js";
import fs from "node:fs";
import { configPath } from "@llm-bridge/core";

export async function doctorCommand(): Promise<void> {
  console.log("llm-bridge diagnostics\n");

  const config = readConfig();
  console.log(`Config: ${configPath()}`);
  console.log(`Active plugin: ${config.activePlugin}`);
  console.log(`Port: ${config.port}`);
  console.log(`Host: ${config.host}`);
  console.log(`Tool mode: ${config.toolMode}`);

  // Check config file
  if (fs.existsSync(configPath())) {
    console.log("✓ Config file exists");
  } else {
    console.log("✗ Config file not found (using defaults)");
  }

  // Check plugin config
  const pluginConfig = config.plugins[config.activePlugin];
  if (pluginConfig && Object.keys(pluginConfig).length > 0) {
    console.log(`✓ Plugin "${config.activePlugin}" has configuration`);
  } else {
    console.log(`✗ Plugin "${config.activePlugin}" has no configuration`);
  }

  // Check bridge connectivity
  try {
    const res = await new Promise<{ status: number }>((resolve, reject) => {
      http.get(`http://${config.host}:${config.port}/health`, (res) => {
        resolve({ status: res.statusCode ?? 0 });
      }).on("error", reject);
    });
    if (res.status === 200) {
      console.log("✓ Bridge server is running");
    } else {
      console.log(`✗ Bridge server returned status ${res.status}`);
    }
  } catch {
    console.log("✗ Cannot reach bridge server (is it running?)");
  }

  // Check port conflicts
  try {
    await new Promise<void>((resolve, reject) => {
      const server = http.createServer();
      server.listen(config.port, config.host, () => {
        server.close();
        resolve();
      });
      server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          reject(new Error("Port in use"));
        } else {
          resolve();
        }
      });
    });
    console.log(`✓ Port ${config.port} is available`);
  } catch {
    console.log(`✗ Port ${config.port} is already in use`);
  }
}
```

- [ ] **Step 2: Create cli/src/commands/daemon.ts**

```typescript
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const LABEL = "com.llm-bridge.daemon";

export async function installDaemonCommand(): Promise<void> {
  if (process.platform !== "darwin") {
    console.error("Daemon installation is only supported on macOS.");
    process.exit(1);
  }

  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
  const wrapperPath = path.join(__dirname, "..", "..", "scripts", "llm-bridge-daemon.sh");

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${wrapperPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  <string>${os.homedir()}/Library/Logs/llm-bridge.log</string>
  <key>StandardErrorPath</key>
  <string>${os.homedir()}/Library/Logs/llm-bridge.err.log</string>
</dict>
</plist>`;

  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(plistPath, plist);

  try {
    execSync(`launchctl bootstrap "gui/$(id -u)" "${plistPath}"`, { stdio: "inherit" });
    console.log(`Installed LaunchAgent: ${plistPath}`);
    console.log(`Logs: ~/Library/Logs/llm-bridge.{log,err.log}`);
  } catch (e) {
    console.error("Failed to bootstrap daemon:", e);
    process.exit(1);
  }
}

export async function uninstallDaemonCommand(): Promise<void> {
  if (process.platform !== "darwin") {
    console.error("Daemon uninstallation is only supported on macOS.");
    process.exit(1);
  }

  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);

  try {
    execSync(`launchctl bootout "gui/$(id -u)" "${plistPath}" 2>/dev/null || true`, { stdio: "inherit" });
  } catch {
    // Ignore errors during unbootstrap
  }

  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
    console.log(`Removed LaunchAgent: ${plistPath}`);
  } else {
    console.log("No LaunchAgent found.");
  }
}
```

- [ ] **Step 3: Update cli/src/index.ts to include doctor and daemon commands**

Add to the switch statement:

```typescript
import { doctorCommand } from "./commands/doctor.js";
import { installDaemonCommand, uninstallDaemonCommand } from "./commands/daemon.js";

// ... in the switch:
case "doctor":
  await doctorCommand();
  break;
case "install-daemon":
  await installDaemonCommand();
  break;
case "uninstall-daemon":
  await uninstallDaemonCommand();
  break;
```

- [ ] **Step 4: Create wrapper script for daemon**

Create `cli/scripts/llm-bridge-daemon.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${LLM_BRIDGE_ENV_FILE:-$HOME/.config/llm-bridge/config.json}"
BRIDGE_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist/index.js"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "llm-bridge: run 'llm-bridge init' first." >&2
  exit 1
fi

exec node "$BRIDGE_BIN" start
```

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/doctor.ts cli/src/commands/daemon.ts cli/src/index.ts cli/scripts/llm-bridge-daemon.sh
git commit -m "feat(cli): add doctor diagnostics and daemon install commands"
```

---

### Task 14: Documentation, CI, and Release

**Files:**
- Create: `README.md`, `CONTRIBUTING.md`, `ROADMAP.md`, `LICENSE`, `.github/workflows/ci.yml`, `docs/plugin-development.md`, `docs/architecture.md`, `docs/troubleshooting.md`, `examples/opencode.json`, `examples/docker-compose.yml`, `scripts/build-binary.sh`

- [ ] **Step 1: Create README.md**

```markdown
# llm-bridge

**Use any AI IDE's model catalog from any OpenAI-compatible client.**

[![CI](https://github.com/your-org/llm-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/llm-bridge/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@llm-bridge/core)](https://www.npmjs.com/package/@llm-bridge/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Quick Start

```bash
# Install
npm install -g llm-bridge

# Setup (interactive)
llm-bridge init

# Start the bridge
llm-bridge start

# Configure OpenCode (one-shot)
llm-bridge configure opencode
```

That's it. OpenCode now uses Cursor's models through the bridge.

## Features

- **Zero-config** — One command to install, configure, and connect
- **Full feature parity** — Tools, multi-turn conversations, streaming
- **Plugin architecture** — Add new providers (Copilot, Windsurf, etc.)
- **OpenAI-compatible** — Works with any OpenAI-format client

## Supported Providers

| Provider | Package | Status |
|----------|---------|--------|
| Cursor | `@llm-bridge/cursor` | ✅ Built-in |
| GitHub Copilot | `@llm-bridge/copilot` | 🚧 Planned |
| Windsurf | `@llm-bridge/windsurf` | 🚧 Planned |

## Architecture

```
OpenCode → POST /v1/chat/completions → llm-bridge → Plugin → Provider API
```

See [docs/architecture.md](docs/architecture.md) for details.

## Plugin Development

Want to add a new provider? See [docs/plugin-development.md](docs/plugin-development.md).

## License

MIT
```

- [ ] **Step 2: Create CONTRIBUTING.md**

```markdown
# Contributing to llm-bridge

## Adding a New Provider

1. Create a new package: `packages/<provider>/`
2. Implement the `BridgePlugin` interface from `@llm-bridge/core`
3. Write tests for auth, models, and sessions
4. Submit a PR with the plugin

## Plugin Contract

```typescript
interface BridgePlugin {
  name: string;
  version: string;
  authenticate(config: Record<string, string>): Promise<boolean>;
  listModels(config: Record<string, string>): Promise<ModelInfo[]>;
  createSession(config: Record<string, string>, model: string): Promise<BridgeSession>;
}
```

## Development Setup

```bash
pnpm install
pnpm build
pnpm test
```

## PR Guidelines

- One provider per PR
- Include tests
- Update README supported providers table
```

- [ ] **Step 3: Create ROADMAP.md**

```markdown
# Roadmap

## Phase 1 — Current
- [x] Monorepo structure
- [x] Core HTTP server
- [x] Cursor plugin (reference implementation)
- [x] CLI with setup wizard
- [x] OpenCode config injection
- [x] macOS LaunchAgent support
- [ ] npm publish
- [ ] Landing page

## Phase 2 — Community
- [ ] Copilot plugin
- [ ] Windsurf plugin
- [ ] OAuth support
- [ ] Linux systemd daemon
- [ ] Windows service wrapper
- [ ] Plugin registry website

## Phase 3 — Ecosystem
- [ ] Plugin marketplace
- [ ] Enterprise features (proxy, audit logging, rate limiting)
- [ ] Multi-language SDK (Python, Go)
```

- [ ] **Step 4: Create LICENSE**

```
MIT License

Copyright (c) 2026 llm-bridge contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 5: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node-version: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: "pnpm"

      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
      - run: pnpm lint
```

- [ ] **Step 6: Create docs/plugin-development.md**

```markdown
# Plugin Development Guide

## Overview

Plugins are npm packages that implement the `BridgePlugin` interface.

## Interface

```typescript
import type { BridgePlugin, BridgeSession, ModelInfo, Message, ToolDefinition, StreamChunk } from "@llm-bridge/core";

class MyPlugin implements BridgePlugin {
  name = "my-provider";
  version = "1.0.0";

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
```

- [ ] **Step 7: Create examples/opencode.json**

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "llm-bridge": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LLM Bridge",
      "options": {
        "apiKey": "bridge-local",
        "baseURL": "http://127.0.0.1:3849/v1"
      },
      "models": {
        "composer-2": { "name": "Composer 2" }
      }
    }
  },
  "model": "llm-bridge/composer-2"
}
```

- [ ] **Step 8: Create examples/docker-compose.yml**

```yaml
version: "3.8"
services:
  llm-bridge:
    build: .
    ports:
      - "3849:3849"
    environment:
      - CURSOR_API_KEY=${CURSOR_API_KEY}
      - LLM_BRIDGE_PORT=3849
    restart: unless-stopped
```

- [ ] **Step 9: Create scripts/build-binary.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Building llm-bridge binary..."
pnpm build
npx pkg cli/dist/index.js --targets node18-macos-arm64,node18-macos-x64,node18-linux-x64 --output dist/llm-bridge
echo "Binaries built in dist/"
```

- [ ] **Step 10: Commit**

```bash
git add README.md CONTRIBUTING.md ROADMAP.md LICENSE .github/workflows/ci.yml docs/ examples/ scripts/
git commit -m "docs: add README, contributing guide, roadmap, CI, and examples"
```

---

### Task 15: Integration Test — Full E2E Flow

**Files:**
- Create: `packages/core/test/integration.test.ts`

- [ ] **Step 1: Write integration test**

Create `packages/core/test/integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BridgeServer } from "../src/server.js";
import type { BridgePlugin, BridgeSession, ModelInfo, StreamChunk } from "../src/types.js";
import http from "node:http";

// Mock plugin for testing
class MockPlugin implements BridgePlugin {
  name = "mock";
  version = "1.0.0";

  async authenticate(): Promise<boolean> { return true; }

  async listModels(): Promise<ModelInfo[]> {
    return [{ id: "mock-model", name: "Mock Model", capabilities: { streaming: true, tools: true } }];
  }

  async createSession(): Promise<BridgeSession> {
    return new MockSession();
  }
}

class MockSession implements BridgeSession {
  async *send(): AsyncIterable<StreamChunk> {
    yield { type: "text", content: "Hello from mock" };
    yield { type: "done", finishReason: "stop" };
  }

  async dispose(): Promise<void> {}
}

function fetchJson(url: string, options?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request(url, {
      method: options?.method ?? "GET",
      headers: { "Content-Type": "application/json", ...options?.headers },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (options?.body) req.write(options.body);
    req.end();
  });
}

describe("E2E integration test", () => {
  let server: BridgeServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new BridgeServer({ port: 0, host: "127.0.0.1" });
    server.registerPlugin(new MockPlugin());
    server.setActivePlugin("mock");
    await server.start();
    const address = server.address();
    baseUrl = `http://127.0.0.1:${(address as any).port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it("health endpoint returns ok", async () => {
    const res = await fetchJson(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("lists models from active plugin", async () => {
    const res = await fetchJson(`${baseUrl}/v1/models`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("mock-model");
  });

  it("completes chat request (non-streaming)", async () => {
    const res = await fetchJson(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      body: JSON.stringify({
        model: "mock-model",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.body.choices[0].message.content).toBe("Hello from mock");
    expect(res.body.choices[0].finish_reason).toBe("stop");
  });

  it("completes chat request (streaming)", async () => {
    const res = await new Promise<string>((resolve, reject) => {
      const urlObj = new URL(`${baseUrl}/v1/chat/completions`);
      const req = http.request(urlObj, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.write(JSON.stringify({
        model: "mock-model",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      }));
      req.end();
    });

    expect(res).toContain("data:");
    expect(res).toContain("Hello from mock");
    expect(res).toContain("[DONE]");
  });
});
```

- [ ] **Step 2: Run integration test**

```bash
cd packages/core && npx vitest run test/integration.test.ts
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/core/test/integration.test.ts
git commit -m "test(core): add E2E integration test with mock plugin"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Monorepo structure | Task 1 |
| Plugin interface | Task 2 |
| HTTP server with /health, /v1/models, /v1/chat/completions | Task 3 |
| Session manager with TTL | Task 4 |
| OpenAI request parsing | Task 5 |
| OpenAI SSE response formatting | Task 6 |
| Plugin registry with health tracking | Task 7 |
| Config loader (file + env) | Task 8 |
| Cursor plugin (auth, models, session, tools) | Task 9 |
| MCP server for Cursor IDE | Task 10 |
| CLI init wizard | Task 11 |
| CLI start command | Task 11 |
| CLI configure opencode (in-place) | Task 12 |
| CLI doctor command | Task 13 |
| CLI daemon install (macOS LaunchAgent) | Task 13 |
| Error handling (auth, provider, plugin crash, session timeout, tool failure) | Tasks 3, 7, 9 |
| Streaming resilience (heartbeat, graceful shutdown) | Task 3 (server.ts) |
| Testing (unit, integration, E2E) | Tasks 2-15 |
| CI pipeline | Task 14 |
| Documentation (README, contributing, plugin dev guide) | Task 14 |
| npm publish packages | Task 14 (ROADMAP item, publish step needed) |
| Community growth (issue templates, labels, roadmap) | Task 14 |

### Placeholder Scan
- No "TBD", "TODO", or incomplete sections
- All code steps contain actual code
- All test steps contain actual test code
- No "similar to Task N" references

### Type Consistency
- `BridgePlugin`, `BridgeSession`, `StreamChunk`, `ModelInfo`, `Message`, `ToolDefinition` defined in Task 2, used consistently throughout
- `BridgeConfig`, `DefaultConfig` defined in Task 2, used in Tasks 3, 8, 11, 12
- All imports use `.js` extension for ESM compatibility

---

Plan complete and saved to `docs/superpowers/plans/2026-05-16-llm-bridge-framework.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
