<p align="center">
  <img src="docs/assets/logo.svg" alt="llm-bridge" width="120" height="120">
</p>

<h1 align="center">llm-bridge</h1>

<p align="center">
  <strong>Use any AI IDE's model catalog from any OpenAI-compatible client.</strong>
</p>

<p align="center">
  <a href="https://github.com/anomalyco/llm-bridge/actions/workflows/ci.yml"><img src="https://github.com/anomalyco/llm-bridge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-18%2B-green" alt="Node.js 18+"></a>
</p>

---

## What is llm-bridge?

llm-bridge is a local HTTP server that translates **OpenAI-compatible API requests** into provider-specific calls. It lets you use models from AI IDEs (Cursor, Windsurf, Copilot, etc.) from any OpenAI-format client — [OpenCode](https://opncd.ai), Continue, custom apps, or anything else.

```
Your Client ──POST /v1/chat/completions──► llm-bridge ──► Provider API
(OpenCode,                                (port 3849)   (Cursor, Copilot,
 Continue, etc.)                                       Windsurf, etc.)
                ◄── SSE / JSON response ──◄
```

## Quick Start

```bash
# Install
npm install -g llm-bridge

# Setup (interactive wizard)
llm-bridge init

# Start the bridge server
llm-bridge start

# Configure OpenCode (one-shot injection)
llm-bridge configure
```

That's it. Your client now has access to Cursor's model catalog.

## Features

| Feature | Description |
|---------|-------------|
| **Zero-config** | One command to install, configure, and connect |
| **Full feature parity** | Tool calls, multi-turn conversations, streaming |
| **Plugin architecture** | Add new providers with a simple interface |
| **OpenAI-compatible** | Works with any OpenAI-format client |
| **macOS daemon** | Auto-starts at login via LaunchAgent |
| **MCP server** | Manage the bridge from inside Cursor IDE |

## Supported Providers

| Provider | Package | Status |
|----------|---------|--------|
| [Cursor](https://cursor.com) | `@llm-bridge/cursor` | ✅ Built-in |
| GitHub Copilot | `@llm-bridge/copilot` | 🚧 Planned |
| Windsurf | `@llm-bridge/windsurf` | 🚧 Planned |

Want to add a provider? See [Adding a Provider](#adding-a-provider) below.

## Architecture

llm-bridge is a **monorepo** with four packages:

| Package | Description |
|---------|-------------|
| `@llm-bridge/core` | HTTP server, plugin registry, session management, request/response formatting |
| `@llm-bridge/cursor` | Cursor SDK plugin — the reference implementation |
| `@llm-bridge/mcp` | MCP server for Cursor IDE integration |
| `llm-bridge` | CLI — setup wizard, server launcher, config injector, diagnostics |

See [docs/architecture.md](docs/architecture.md) for a detailed breakdown.

## Configuration

Config lives in `~/.config/llm-bridge/config.json`:

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

Environment variables override config file values: `LLM_BRIDGE_PORT`, `LLM_BRIDGE_HOST`, `LLM_BRIDGE_CONFIG`.

## CLI Commands

| Command | Description |
|---------|-------------|
| `llm-bridge init` | Interactive setup wizard |
| `llm-bridge start` | Launch bridge server |
| `llm-bridge configure` | Inject provider config into OpenCode |
| `llm-bridge doctor` | Run diagnostics |
| `llm-bridge install-daemon` | Install macOS LaunchAgent |
| `llm-bridge uninstall-daemon` | Remove macOS LaunchAgent |

## Adding a Provider

1. Create a new package: `packages/<provider>/`
2. Implement the [`BridgePlugin`](docs/plugin-development.md) interface from `@llm-bridge/core`
3. Write tests for auth, models, and sessions
4. Submit a PR

See [docs/plugin-development.md](docs/plugin-development.md) for the full guide.

## Troubleshooting

Common issues and solutions: [docs/troubleshooting.md](docs/troubleshooting.md)

Run `llm-bridge doctor` for a full diagnostic check.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full development plan.

**Phase 1** ✅ — Core framework, Cursor plugin, CLI, docs
**Phase 2** 🚧 — Copilot/Windsurf plugins, OAuth, Linux/Windows daemons
**Phase 3** 🔮 — Plugin marketplace, enterprise features, multi-language SDKs

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.
