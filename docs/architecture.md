# Architecture

## Overview

llm-bridge is a local HTTP server that translates OpenAI-compatible API requests into provider-specific calls (Cursor SDK, etc.), enabling any OpenAI-format client to use any AI IDE's model catalog. Multiple plugins can be registered simultaneously, with requests routed by model ID prefix.

## System Diagram

```
┌─────────────┐     POST /v1/chat/completions     ┌──────────────────┐
│   OpenCode   │ ────────────────────────────────► │   llm-bridge     │
│  (or any     │                                   │   HTTP Server    │
│   client)    │ ◄──────────────────────────────── │   (port 3849)    │
└─────────────┘      SSE stream / JSON response    └────────┬─────────┘
                                                             │
                                                    Model Prefix Router
                                                             │
              ┌──────────────────────────┬───────────────────┼───────────────────┬──────────────────────────┐
              │                          │                   │                   │                          │
       cursor/* prefix            copilot/* prefix           │            windsurf/* prefix           default (unprefixed)
              │                          │                   │                   │                          │
       ┌──────▼──────┐            ┌──────▼──────┐            │            ┌──────▼──────┐            ┌──────▼──────┐
       │  Cursor      │            │  Copilot     │            │            │  Windsurf    │            │ defaultPlugin│
       │  (HTTP)      │            │  (HTTP)      │            │            │  (Daemon)    │            │   fallback  │
       └──────┬──────┘            └──────┬──────┘            │            └──────┬──────┘            └─────────────┘
              │                          │                   │                   │
       ┌──────▼──────┐            ┌──────▼──────┐            │            ┌──────▼──────┐
       │ Cursor API  │            │ Copilot API │            │            │ Language    │
       │ (cloud)     │            │ (cloud)     │            │            │ Server      │
       └─────────────┘            └─────────────┘            │            │ (stdio)     │
                                                             │            └─────────────┘
```

## Components

### Core (`@ai-ide-bridge/core`)

The HTTP server and shared infrastructure:

- **Server** — Node.js native `http` module, routes: `/health`, `/v1/models`, `/v1/chat/completions`
- **Parser** — Validates OpenAI request format using Zod schemas
- **Formatter** — Translates provider stream chunks into OpenAI SSE format
- **Session Store** — In-memory session management with TTL cleanup
- **Plugin Registry** — Loads, activates, and tracks plugin health
- **Model Router** — Resolves model ID prefixes to registered plugins
- **Config** — File-based config (`~/.config/llm-bridge/config.json`) with env var overrides

### Plugins

Each provider is a separate package implementing `BridgePlugin`:

- **authenticate(config)** — Validate credentials
- **listModels(config)** — Return available models
- **createSession(config, model)** — Create a session for streaming responses

The Cursor plugin (`@ai-ide-bridge/cursor`) is the reference implementation using `@cursor/sdk`.

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

The CLI config uses `defaultPlugin` to specify which plugin handles unprefixed model IDs.

### MCP Server (`@ai-ide-bridge/mcp`)

Stdio MCP server for Cursor IDE integration:

- `bridge_status` — Health check
- `list_models` — Available models
- `generate_opencode_config` — Provider fragment generator

## Model Routing

Model IDs are resolved to plugins using a prefix-based routing system:

### Prefix Resolution Logic

1. **Prefixed model ID** (e.g., `cursor/composer-2`):
   - Extract the prefix (`cursor`) before the first `/`
   - Look up the registered plugin with that name
   - Strip the prefix and pass the remainder (`composer-2`) to the plugin
   - If the prefix doesn't match any registered plugin, return `400 bad_request`

2. **Double-prefixed model ID** (e.g., `llm-bridge/cursor/composer-2`):
   - The first segment is the provider name in the client config
   - The second segment is the plugin prefix
   - Strip both and pass the remainder to the plugin

3. **Unprefixed model ID** (e.g., `composer-2`):
   - Route to the `defaultPlugin` configured in `~/.config/llm-bridge/config.json`
   - If no `defaultPlugin` is set, return `400 bad_request`

### Routing Table

| Model ID                     | Prefix     | Target Plugin             | Model Passed to Plugin |
| ---------------------------- | ---------- | ------------------------- | ---------------------- |
| `cursor/composer-2`          | `cursor`   | `@ai-ide-bridge/cursor`   | `composer-2`           |
| `copilot/gpt-4o-copilot`     | `copilot`  | `@ai-ide-bridge/copilot`  | `gpt-4o-copilot`       |
| `windsurf/claude-4.5-sonnet` | `windsurf` | `@ai-ide-bridge/windsurf` | `claude-4.5-sonnet`    |
| `composer-2`                 | (none)     | `defaultPlugin`           | `composer-2`           |

### Model Listing

`GET /v1/models` returns the union of all models from all registered plugins, each prefixed with its plugin name:

```json
{
  "data": [
    { "id": "cursor/composer-2", "object": "model", "created": 0, "owned_by": "cursor" },
    { "id": "copilot/gpt-4o-copilot", "object": "model", "created": 0, "owned_by": "copilot" },
    { "id": "windsurf/claude-4.5-sonnet", "object": "model", "created": 0, "owned_by": "windsurf" }
  ]
}
```

## Data Flow

1. Client sends `POST /v1/chat/completions` with OpenAI-format body and a `model` field
2. Server validates request via Zod parser
3. **Model Router** extracts the prefix from the model ID and resolves it to a registered plugin
4. Server routes to the resolved plugin's `createSession()` with the stripped model ID
5. Plugin creates provider-specific session
6. Server iterates session's `AsyncIterable<StreamChunk>`
7. Each chunk is formatted as OpenAI SSE and written to response
8. On completion, session is disposed

## Error Handling

| Scenario                | Response                                          |
| ----------------------- | ------------------------------------------------- |
| Missing auth            | `401 authentication_error`                        |
| Provider API error      | `502 provider_error`                              |
| Plugin crash            | `500 plugin_error`, marked unhealthy              |
| Session timeout (30min) | Auto-dispose, new session on next request         |
| Tool call rejected      | Warning logged, text-only fallback (lenient mode) |
| Unknown model prefix    | `400 bad_request: unknown prefix "xyz"`           |
| No default plugin       | `400 bad_request: no default plugin configured`   |
| Plugin not registered   | `400 bad_request: plugin "xyz" not registered`    |
