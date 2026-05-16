# LLM Bridge — Multi-Provider Framework Design

**Date:** 2026-05-16
**Status:** Draft
**Author:** Brainstorming Session

## Summary

Restructure `cursor-opencode-mcp` into `llm-bridge`, a monorepo-based multi-provider framework that enables any AI IDE's model catalog to be consumed by any OpenAI-compatible client (OpenCode, Continue, custom apps). Cursor becomes the reference implementation. The goal is zero-config setup, full feature parity (tools, multi-turn, streaming), and a plugin architecture that encourages community contributions.

## Goals

1. **Zero-config experience** — One command to install, configure, and connect. No manual JSON editing.
2. **Full feature parity** — Tool forwarding, multi-turn conversation state, streaming, file context.
3. **Plugin architecture** — Clear contract for adding new providers (Copilot, Windsurf, etc.).
4. **Open-source growth** — Single repo for community, clear contribution paths, public roadmap.

## Non-Goals (Phase 1)

- OAuth-based authentication (relies on API keys; OAuth is Phase 2+)
- Web UI dashboard (CLI-only for now)
- Windows daemon support (macOS LaunchAgent + Linux systemd in Phase 2)
- Plugin registry website (npm discovery is sufficient for Phase 1)

## Architecture

### Monorepo Structure

```
llm-bridge/
├── packages/
│   ├── core/           # @llm-bridge/core — OpenAI HTTP server, session manager, streaming engine, plugin registry
│   ├── cursor/         # @llm-bridge/cursor — Cursor SDK plugin (reference implementation)
│   └── mcp/            # @llm-bridge/mcp — MCP server for Cursor IDE integration
├── cli/                # llm-bridge CLI — setup wizard, plugin management, daemon installer
├── docs/               # Plugin dev guide, architecture, troubleshooting, FAQ
├── examples/           # OpenCode config, docker-compose, integration examples
├── package.json        # Root workspace config
└── turbo.json          # Turborepo configuration (or pnpm workspaces)
```

### Plugin Interface

```typescript
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

interface ModelInfo {
  id: string;
  name: string;
  capabilities?: { streaming?: boolean; tools?: boolean; vision?: boolean };
}

interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolCall?: { id: string; name: string; arguments: string };
  finishReason?: 'stop' | 'tool_calls' | 'error' | 'length';
}
```

### Data Flow

```
OpenCode → POST /v1/chat/completions → Core HTTP Server
  → Auth validation (Bearer token passthrough, plugin handles real auth)
  → Plugin Router (selects active plugin from config)
  → Session Manager (create/retrieve session by ID, TTL cleanup)
  → Plugin.createSession() → BridgeSession
  → session.send(messages, tools) → AsyncIterable<StreamChunk>
  → Core SSE Formatter → OpenAI-compatible chunks → Response stream
  → session.dispose() on completion/error
```

## Components

### @llm-bridge/core

**Responsibilities:**

- HTTP server using Node.js native `http` module (no Express)
- Routes: `GET /health`, `GET /v1/models`, `POST /v1/chat/completions`
- Request parser: OpenAI wire format → internal `Message[]` + `ToolDefinition[]`
- Response formatter: Provider `StreamChunk` → OpenAI SSE format
- Session store: in-memory `Map<sessionId, { session, lastActive }>` with 30-minute TTL cleanup
- Plugin registry: `loadPlugin(name)`, `listPlugins()`, `getActivePlugin()`, health tracking
- Config loader: `~/.config/llm-bridge/config.json` or env vars (`LLM_BRIDGE_*`)

**Key design decisions:**

- No external HTTP framework — keep dependency tree minimal, faster startup
- Sessions keyed by optional `X-Session-ID` header; auto-generated if absent
- Plugin crashes are isolated — one bad plugin doesn't bring down the server

### @llm-bridge/cursor

**Responsibilities:**

- Implements `BridgePlugin` using `@cursor/sdk`
- Auth: `Cursor.me({ apiKey })` validates `CURSOR_API_KEY`
- Models: `Cursor.models.list({ apiKey })` → normalized `ModelInfo[]`
- Session: `Agent.create()` + `agent.send()` with `onDelta` → yields `StreamChunk`
- Tool forwarding: maps OpenCode tool definitions to Cursor tool schema, captures results, feeds back into conversation
- Multi-turn: maintains context within session via Cursor SDK's native `Agent` state

**Migration from current code:**

- Extract `bridge.ts` logic into plugin's `createSession()` and `send()`
- Replace single-prompt folding with proper multi-turn session management
- Add tool call translation layer (currently logged and ignored)

### @llm-bridge/mcp

**Responsibilities:**

- Stdio MCP server registered in Cursor IDE
- Tools:
  - `bridge_status` — health check, active plugin, server uptime
  - `list_models` — available models from active provider
  - `generate_opencode_config` — writes provider fragment to user's `opencode.json`
  - `switch_plugin` — change active provider (future: multi-provider support)
- Does NOT terminate LLM traffic — delegates to bridge server

### llm-bridge CLI

**Commands:**

- `llm-bridge init` — Interactive wizard: select provider, enter API key, test connection, write config
- `llm-bridge start` — Launch bridge server (foreground)
- `llm-bridge install <plugin>` — Install community plugin from npm
- `llm-bridge doctor` — Diagnose: port conflicts, missing keys, plugin errors, connectivity
- `llm-bridge configure opencode` — Inject provider fragment into existing `opencode.json` (in-place modification)
- `llm-bridge install-daemon` — Install system service (macOS LaunchAgent, future: systemd)
- `llm-bridge uninstall-daemon` — Remove system service

**Distribution:**

- Standalone binary compiled with `pkg` or `nexe`
- npm install also available for Node.js environments
- Pre-built binaries for macOS (arm64, x64), Linux (x64)

## Error Handling

| Scenario                | Response                                          | Action                                     |
| ----------------------- | ------------------------------------------------- | ------------------------------------------ |
| Missing/invalid auth    | `401 { error: { type: "authentication_error" } }` | Log, return immediately                    |
| Provider API error      | `502 { error: { type: "provider_error" } }`       | Log with full error, return mapped message |
| Plugin crash            | `500 { error: { type: "plugin_error" } }`         | Catch, log, mark plugin unhealthy, return  |
| Session timeout (30min) | New session created on next request               | Auto-dispose old session                   |
| Tool call rejected      | Warning logged, text-only fallback                | Configurable: strict vs lenient mode       |
| Upstream stream dies    | Synthetic `finish_reason: "error"` chunk          | Close SSE stream cleanly                   |

**Streaming resilience:**

- 30-second heartbeat ping via SSE comment (`: ping`)
- Connection keep-alive headers on all responses
- Graceful shutdown: finish in-flight requests before closing

## Configuration

**Config file:** `~/.config/llm-bridge/config.json`

```json
{
  "activePlugin": "cursor",
  "port": 3849,
  "host": "127.0.0.1",
  "plugins": {
    "cursor": {
      "CURSOR_API_KEY": "cursor_..."
    }
  },
  "sessionTTL": 1800,
  "toolMode": "lenient"
}
```

**Environment variable overrides:** `LLM_BRIDGE_PORT`, `LLM_BRIDGE_HOST`, `LLM_BRIDGE_CONFIG`, `LLM_BRIDGE_PLUGIN_*`

## Testing Strategy

| Layer       | Scope                                                               | Tools                            |
| ----------- | ------------------------------------------------------------------- | -------------------------------- |
| Unit        | Request parsing, SSE formatting, session lifecycle, plugin registry | Vitest                           |
| Integration | Mock `@cursor/sdk`, test auth, tool forwarding, multi-turn          | Vitest + mock servers            |
| E2E         | Full bridge + mock provider → validate SSE output                   | Playwright / custom test harness |
| CLI         | Config read/write, daemon install, doctor diagnostics               | Vitest + temp directories        |

**CI (GitHub Actions):**

- Lint (biome or eslint), typecheck, test
- Node 18/20/22 matrix
- macOS + Linux runners
- Coverage threshold: 80%

## Community Growth Strategy

### Phase 1 (This Release)

- Restructure to monorepo, Cursor as reference plugin
- README: 3-line setup, animated GIF, clear value proposition
- docs/: Plugin dev guide, architecture, troubleshooting
- CONTRIBUTING.md: Plugin contract, PR template, code of conduct
- GitHub: Issue templates, labels, milestones, ROADMAP.md
- npm publish: `@llm-bridge/core`, `@llm-bridge/cursor`
- Landing page: VitePress docs site at `llm-bridge.dev`

### Phase 2 (Community-Driven)

- Copilot, Windsurf plugins (community or core team)
- OAuth support for providers that require it
- Linux systemd daemon, Windows service wrapper
- Plugin registry website (discoverable community plugins)

### Phase 3 (Ecosystem)

- Plugin marketplace with ratings, downloads, compatibility badges
- Enterprise features: proxy support, audit logging, rate limiting
- SDK for building custom plugins in other languages (Python, Go)

## Migration Plan

1. Create new `llm-bridge` repo with monorepo structure
2. Move `core/` — extract HTTP server, session management from current `bridge.ts`
3. Move `cursor/` — refactor existing Cursor SDK usage into plugin interface
4. Move `mcp/` — update MCP server to use new plugin registry
5. Build `cli/` — new standalone binary with setup wizard
6. Write docs, examples, CI pipeline
7. Publish npm packages, release binaries
8. Announce on OpenCode Discord, Cursor forums, Hacker News, Reddit

## Open Questions

1. **Repo name:** `llm-bridge` is placeholder. Alternatives: `ai-bridge`, `model-bridge`, `open-model-bridge`. Domain availability needs checking.
2. **Monorepo tool:** Turborepo vs pnpm workspaces vs Nx. Turborepo is lightweight and familiar to most JS devs.
3. **Binary compiler:** `pkg` (maintained by Vercel) vs `nexe` vs `bun build --compile`. `pkg` has best ecosystem support.
4. **Session persistence:** In-memory is fine for Phase 1. Should we plan for Redis/file-based persistence in Phase 2 for daemon mode?
