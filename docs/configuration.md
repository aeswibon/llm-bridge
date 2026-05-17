# Configuration Reference

## Config File

Location: `~/.config/llm-bridge/config.json`

### Full Schema

```json
{
  "defaultPlugin": "cursor",
  "port": 3849,
  "host": "127.0.0.1",
  "plugins": {
    "cursor": {
      "CURSOR_API_KEY": "cursor_..."
    },
    "copilot": {
      "GITHUB_TOKEN": "ghp_..."
    },
    "windsurf": {
      "WINDSURF_TOKEN": "windsurf_..."
    }
  },
  "sessionTTL": 1800,
  "toolMode": "lenient"
}
```

### Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `defaultPlugin` | string | `"cursor"` | Plugin used when model name has no prefix. Also used by `llm-bridge configure` |
| `port` | number | `3849` | HTTP server port |
| `host` | string | `"127.0.0.1"` | HTTP server bind address |
| `plugins` | object | `{}` | Provider credentials. Keys are plugin names, values are credential objects |
| `sessionTTL` | number | `1800` | Session lifetime in seconds (30 min). Sessions are disposed after this time |
| `toolMode` | string | `"lenient"` | Tool call handling: `"strict"` rejects invalid tool calls, `"lenient"` falls back to text |

### `plugins` Object

Each key is a plugin name. Each value is a credential object with environment-variable-style keys:

```json
{
  "plugins": {
    "cursor": {
      "CURSOR_API_KEY": "cursor_abc123"
    },
    "windsurf": {
      "WINDSURF_TOKEN": "windsurf_xyz789",
      "WINDSURF_LANGUAGE_SERVER_PATH": "/custom/path/language_server"
    }
  }
}
```

**Credential keys per provider:**

| Provider | Required Keys | Optional Keys |
|----------|--------------|---------------|
| cursor | `CURSOR_API_KEY` | — |
| copilot | `GITHUB_TOKEN` | — |
| windsurf | `WINDSURF_TOKEN` | `WINDSURF_LANGUAGE_SERVER_PATH` |

---

## Environment Variables

All config values can be overridden via environment variables:

| Variable | Overrides | Description |
|----------|-----------|-------------|
| `LLM_BRIDGE_PORT` | `port` | Server port |
| `LLM_BRIDGE_HOST` | `host` | Server bind address |
| `LLM_BRIDGE_CONFIG` | entire config | Path to config file (default: `~/.config/llm-bridge/config.json`) |
| `CURSOR_API_KEY` | `plugins.cursor.CURSOR_API_KEY` | Cursor API key |
| `GITHUB_TOKEN` | `plugins.copilot.GITHUB_TOKEN` | GitHub token for Copilot |
| `WINDSURF_TOKEN` | `plugins.windsurf.WINDSURF_TOKEN` | Windsurf token |
| `WINDSURF_LANGUAGE_SERVER_PATH` | `plugins.windsurf.WINDSURF_LANGUAGE_SERVER_PATH` | Custom Windsurf daemon path |

**Precedence:** Environment variables > config file > defaults

---

## Model Routing

When a client sends a request to `/v1/chat/completions`, llm-bridge determines which plugin to route to based on the `model` field:

### With Prefix

```json
{ "model": "cursor/composer-2" }
```
→ Routes to the `cursor` plugin. The prefix (`cursor/`) is stripped before sending to the plugin.

### Without Prefix

```json
{ "model": "composer-2" }
```
→ Routes to `defaultPlugin` (from config, defaults to `cursor`).

### Unknown Prefix

```json
{ "model": "unknown/some-model" }
```
→ Returns `400 Bad Request` with error: `Unknown plugin: "unknown"`

### Available Models

`GET /v1/models` returns all models from all registered plugins, each prefixed:

```json
{
  "object": "list",
  "data": [
    { "id": "cursor/composer-2", "object": "model", "owned_by": "cursor" },
    { "id": "cursor/composer-fast", "object": "model", "owned_by": "cursor" },
    { "id": "copilot/gpt-4o-copilot", "object": "model", "owned_by": "copilot" },
    { "id": "windsurf/claude-4.5-sonnet", "object": "model", "owned_by": "windsurf" },
    { "id": "windsurf/claude-4.5-opus", "object": "model", "owned_by": "windsurf" }
  ]
}
```

---

## Backward Compatibility

Configs created before v1.0.0 with `activePlugin` still work:

```json
{
  "activePlugin": "cursor",
  "port": 3849,
  ...
}
```

On load, `activePlugin` is automatically mapped to `defaultPlugin`. Both fields can coexist — `defaultPlugin` takes precedence if both are set.
