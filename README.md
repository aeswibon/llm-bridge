<p align="center">
  <img src="docs/assets/logo.svg" alt="llm-bridge" width="120" height="120">
</p>

<h1 align="center">llm-bridge</h1>

<p align="center">
  <strong>Use any AI IDE's model catalog from any OpenAI-compatible client.</strong>
</p>

<p align="center">
  <a href="https://github.com/aeswibon/llm-bridge/actions/workflows/pr-build.yml"><img src="https://github.com/aeswibon/llm-bridge/actions/workflows/pr-build.yml/badge.svg" alt="PR Build"></a>
  <a href="https://github.com/aeswibon/llm-bridge/actions/workflows/release.yml"><img src="https://github.com/aeswibon/llm-bridge/actions/workflows/release.yml/badge.svg" alt="Release"></a>
  <a href="https://www.npmjs.com/package/llm-bridge"><img src="https://img.shields.io/npm/v/llm-bridge?label=npm" alt="npm"></a>
  <a href="https://github.com/aeswibon/llm-bridge/pkgs/container/llm-bridge"><img src="https://img.shields.io/badge/docker-ghcr.io-blue" alt="Docker"></a>
  <a href="https://github.com/aeswibon/llm-bridge/releases/latest"><img src="https://img.shields.io/github/v/release/aeswibon/llm-bridge?label=release" alt="GitHub Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-18%2B-green" alt="Node.js 18+"></a>
</p>

---

## What is llm-bridge?

llm-bridge is a local HTTP server that translates **OpenAI-compatible API requests** into provider-specific calls. It lets you use models from 3 AI IDEs — Cursor, GitHub Copilot, and Windsurf — from any OpenAI-format client: [OpenCode](https://opencode.ai), Continue, custom apps, or anything else.

```
Your Client ──POST /v1/chat/completions──► llm-bridge ──► Provider API
(OpenCode,                                (port 3849)   (Cursor, Copilot,
 Continue, etc.)                                       Windsurf, etc.)
                ◄── SSE / JSON response ──◄
```

## Quick Start

### npm

```bash
npm install -g llm-bridge
llm-bridge init      # Interactive setup wizard
llm-bridge start     # Launch the bridge server
llm-bridge configure # Inject provider config into OpenCode
```

### Docker

```bash
docker run -d \
  --name llm-bridge \
  -p 3849:3849 \
  -e CURSOR_API_KEY=cursor_your_key \
  -e GITHUB_TOKEN=your_github_token \
  -e WINDSURF_TOKEN=your_windsurf_token \
  ghcr.io/aeswibon/llm-bridge:latest
```

### Homebrew (macOS)

```bash
brew tap aeswibon/llm-bridge-homebrew
brew install llm-bridge
llm-bridge init
llm-bridge start
```

### Binary (macOS / Linux)

Download from [GitHub Releases](https://github.com/aeswibon/llm-bridge/releases/latest):

```bash
# macOS Apple Silicon
curl -sL https://github.com/aeswibon/llm-bridge/releases/latest/download/llm-bridge-macos-arm64 -o llm-bridge
chmod +x llm-bridge
./llm-bridge init
./llm-bridge start
```

That's it. Your client now has access to Cursor's model catalog.

## Features

| Feature                 | Description                                     | Status |
| ----------------------- | ----------------------------------------------- | ------ |
| **Zero-config**         | One command to install, configure, and connect  | ✅     |
| **Full feature parity** | Tool calls, multi-turn conversations, streaming | ✅     |
| **Plugin architecture** | Add new providers with a simple interface       | ✅     |
| **OpenAI-compatible**   | Works with any OpenAI-format client             | ✅     |
| **macOS daemon**        | Auto-starts at login via LaunchAgent            | ✅     |
| **Windsurf support**    | Claude, GPT, Gemini models via local daemon     | ✅     |
| **Copilot support**     | GitHub Copilot models                           | ✅     |
| **OAuth support**       | Device flow authentication                      | ✅     |
| **MCP server**          | Manage the bridge from inside Cursor IDE        | ✅     |
| **Docker ready**        | Official images on GitHub Container Registry    | ✅     |
| **Homebrew tap**        | One-line install on macOS                       | ✅     |
| **Binary releases**     | Pre-built for macOS arm64/x64, Linux x64        | ✅     |
| **Linux systemd**       | Auto-starts via systemd service                 | 🚧     |

## Supported Providers

| Provider                     | Package                | Type   | Status      |
| ---------------------------- | ---------------------- | ------ | ----------- |
| [Cursor](https://cursor.com) | `@llm-bridge/cursor`   | HTTP   | ✅ Built-in |
| GitHub Copilot               | `@llm-bridge/copilot`  | HTTP   | ✅ Built-in |
| [Windsurf](https://windsurf.com) | `@llm-bridge/windsurf` | Daemon | ✅ Built-in |

Want to add a provider? See [Adding a Provider](#adding-a-provider) below.

## Architecture

llm-bridge is a **monorepo** with seven packages:

| Package              | Description                                                                   |
| -------------------- | ----------------------------------------------------------------------------- |
| `@llm-bridge/core`   | HTTP server, plugin registry, session management, daemon abstraction, request/response formatting |
| `@llm-bridge/cursor` | Cursor SDK plugin — HTTP-based reference implementation                       |
| `@llm-bridge/copilot`| GitHub Copilot plugin — HTTP-based implementation                             |
| `@llm-bridge/windsurf`| Windsurf plugin — daemon-based (stdio/JSON-RPC) implementation               |
| `@llm-bridge/oauth`  | OAuth 2.0 device flow authentication helper                                   |
| `@llm-bridge/mcp`    | MCP server for AI IDE integration                                             |
| `llm-bridge`         | CLI — setup wizard, server launcher, daemon management, config injector, diagnostics |

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

| Command                       | Description                          |
| ----------------------------- | ------------------------------------ |
| `llm-bridge init`             | Interactive setup wizard             |
| `llm-bridge start`            | Launch bridge server                 |
| `llm-bridge configure`        | Inject provider config into OpenCode |
| `llm-bridge doctor`           | Run diagnostics                      |
| `llm-bridge install-daemon`   | Install macOS LaunchAgent            |
| `llm-bridge uninstall-daemon` | Remove macOS LaunchAgent             |
| `llm-bridge daemon status`    | Check daemon binary status (Windsurf)|
| `llm-bridge daemon download`  | Download daemon binary (Windsurf)    |
| `llm-bridge daemon locate`    | Find daemon binary path (Windsurf)   |

## Adding a Provider

1. Create a new package: `packages/<provider>/`
2. Implement the [`BridgePlugin`](docs/plugin-development.md) interface from `@llm-bridge/core`
3. Write tests for auth, models, and sessions
4. Submit a PR

See [docs/plugin-development.md](docs/plugin-development.md) for the full guide.

## Development

```bash
git clone https://github.com/aeswibon/llm-bridge.git
cd llm-bridge
pnpm install
pnpm build
pnpm test
```

### Project Structure

```
llm-bridge/
├── packages/
│   ├── core/           # @llm-bridge/core (HTTP server, daemon abstraction)
│   ├── cursor/         # @llm-bridge/cursor (HTTP plugin)
│   ├── copilot/        # @llm-bridge/copilot (HTTP plugin)
│   ├── windsurf/       # @llm-bridge/windsurf (daemon plugin)
│   ├── oauth/          # @llm-bridge/oauth (OAuth 2.0 helper)
│   └── mcp/            # @llm-bridge/mcp (MCP server)
├── cli/                # llm-bridge CLI
├── docs/               # Architecture, plugin dev, troubleshooting, getting started
├── examples/           # OpenCode config, docker-compose
└── .github/            # Workflows, issue templates, homebrew tap
```

## Troubleshooting

Common issues and solutions: [docs/troubleshooting.md](docs/troubleshooting.md)

Run `llm-bridge doctor` for a full diagnostic check.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the full development plan.

- **Phase 1** ✅ — Core framework, Cursor plugin, CLI, docs, CI/CD, Docker, Homebrew, releases
- **Phase 2** ✅ — Copilot/Windsurf plugins, OAuth, daemon architecture
- **Phase 3** 🔮 — Plugin marketplace, enterprise features, multi-language SDKs, Linux/Windows daemons

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.
