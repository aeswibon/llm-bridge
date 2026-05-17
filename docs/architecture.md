# Architecture

## Overview

llm-bridge is a local HTTP server that translates OpenAI-compatible API requests into provider-specific calls (Cursor SDK, etc.), enabling any OpenAI-format client to use any AI IDE's model catalog.

## System Diagram

```
┌─────────────┐     POST /v1/chat/completions     ┌──────────────────┐
│   OpenCode   │ ────────────────────────────────► │   llm-bridge     │
│  (or any     │                                   │   HTTP Server    │
│   client)    │ ◄──────────────────────────────── │   (port 3849)    │
└─────────────┘      SSE stream / JSON response    └────────┬─────────┘
                                                             │
                                                    Plugin Router
                                                             │
                          ┌──────────────────────────────────┼──────────────────────────────────┐
                          │                                  │                                  │
                   ┌──────▼──────┐                    ┌──────▼──────┐                    ┌──────▼──────┐
                   │  Cursor      │                    │  Copilot     │                    │  Windsurf    │
                   │  (HTTP)      │                    │  (HTTP)      │                    │  (Daemon)    │
                   └──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘
                          │                                  │                                  │
                   ┌──────▼──────┐                    ┌──────▼──────┐                    ┌──────▼──────┐
                   │ Cursor API  │                    │ Copilot API │                    │ Language    │
                   │ (cloud)     │                    │ (cloud)     │                    │ Server      │
                   └─────────────┘                    └─────────────┘                    │ (stdio)     │
                                                                                        └─────────────┘
```

## Components

### Core (`@llm-bridge/core`)

The HTTP server and shared infrastructure:

- **Server** — Node.js native `http` module, routes: `/health`, `/v1/models`, `/v1/chat/completions`
- **Parser** — Validates OpenAI request format using Zod schemas
- **Formatter** — Translates provider stream chunks into OpenAI SSE format
- **Session Store** — In-memory session management with TTL cleanup
- **Plugin Registry** — Loads, activates, and tracks plugin health
- **Config** — File-based config (`~/.config/llm-bridge/config.json`) with env var overrides

### Plugins

Each provider is a separate package implementing `BridgePlugin`:

- **authenticate(config)** — Validate credentials
- **listModels(config)** — Return available models
- **createSession(config, model)** — Create a session for streaming responses

The Cursor plugin (`@llm-bridge/cursor`) is the reference implementation using `@cursor/sdk`.

## Plugin Patterns

llm-bridge supports two plugin patterns:

### HTTP-based Plugins

Plugins that communicate with cloud APIs via HTTP requests. Examples: Cursor, Copilot.

```
Plugin ──HTTP POST──► Cloud API ──SSE Stream──► Plugin ──StreamChunk──► Server
```

- Implement `BridgePlugin` interface directly
- Session uses HTTP streaming to receive responses
- Auth via API keys or OAuth tokens

### Daemon-based Plugins

Plugins that spawn a local daemon binary and communicate via stdio/JSON-RPC. Example: Windsurf.

```
Server ──spawn()──► Daemon Process
         ──stdin──► JSON-RPC request
         ◄─stdout── JSON-RPC response (chunks)
         ──kill()──► Daemon cleanup
```

- Uses `DaemonManager` for binary discovery (`locate()`), download (`download()`), and process management (`spawn()`)
- Uses `DaemonBridgeSession` for stdio/JSON-RPC communication
- Binary discovery order: env var → known paths → `~/.llm-bridge/daemons/`
- JSON-RPC 2.0 protocol: `chat/completions` request, `chat/chunk`/`chat/done` responses

### CLI (`llm-bridge`)

Command-line interface for setup and management:

- `init` — Interactive setup wizard
- `start` — Launch bridge server
- `configure` — Inject OpenCode provider config
- `doctor` — Run diagnostics
- `install-daemon` / `uninstall-daemon` — macOS LaunchAgent management
- `daemon status` / `daemon download` / `daemon locate` — Windsurf daemon management

### MCP Server (`@llm-bridge/mcp`)

Stdio MCP server for Cursor IDE integration:

- `bridge_status` — Health check
- `list_models` — Available models
- `generate_opencode_config` — Provider fragment generator

## Data Flow

1. Client sends `POST /v1/chat/completions` with OpenAI-format body
2. Server validates request via Zod parser
3. Server routes to active plugin's `createSession()`
4. Plugin creates provider-specific session
5. Server iterates session's `AsyncIterable<StreamChunk>`
6. Each chunk is formatted as OpenAI SSE and written to response
7. On completion, session is disposed

## Error Handling

| Scenario                | Response                                          |
| ----------------------- | ------------------------------------------------- |
| Missing auth            | `401 authentication_error`                        |
| Provider API error      | `502 provider_error`                              |
| Plugin crash            | `500 plugin_error`, marked unhealthy              |
| Session timeout (30min) | Auto-dispose, new session on next request         |
| Tool call rejected      | Warning logged, text-only fallback (lenient mode) |
