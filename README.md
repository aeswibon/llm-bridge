# llm-bridge

**Use any AI IDE's model catalog from any OpenAI-compatible client.**

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
