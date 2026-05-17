# Getting Started

## Installation

### Option 1: npm (recommended)

```bash
npm install -g llm-bridge
```

### Option 2: Homebrew (macOS)

```bash
brew tap aeswibon/llm-bridge-homebrew
brew install llm-bridge
```

### Option 3: Docker

```bash
docker pull ghcr.io/aeswibon/llm-bridge:latest
```

### Option 4: Binary download

Download from [GitHub Releases](https://github.com/aeswibon/llm-bridge/releases/latest):

```bash
# macOS Apple Silicon
curl -sL https://github.com/aeswibon/llm-bridge/releases/latest/download/llm-bridge-macos-arm64 -o llm-bridge
chmod +x llm-bridge
sudo mv llm-bridge /usr/local/bin/

# Linux x64
curl -sL https://github.com/aeswibon/llm-bridge/releases/latest/download/llm-bridge-linux-x64 -o llm-bridge
chmod +x llm-bridge
sudo mv llm-bridge /usr/local/bin/
```

## Quick Start

### 1. Initialize

```bash
llm-bridge init
```

This interactive wizard will:

- Ask which providers you want to enable (cursor, copilot, windsurf)
- Collect your API tokens
- Generate a config file at `~/.config/llm-bridge/config.json`

### 2. Start the bridge

```bash
llm-bridge start
```

The server starts on `http://127.0.0.1:3849` by default.

### 3. Configure your client

#### OpenCode

```bash
llm-bridge configure
```

This injects the llm-bridge provider into your `opencode.json`.

#### Manual configuration

Add to your client's provider config:

```json
{
  "provider": {
    "llm-bridge": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "LLM Bridge",
      "options": {
        "apiKey": "bridge-local",
        "baseURL": "http://127.0.0.1:3849/v1"
      },
      "models": {
        "cursor/composer-2": { "name": "Cursor Composer 2" },
        "copilot/gpt-4o-copilot": { "name": "GPT-4o (Copilot)" },
        "windsurf/claude-4.5-sonnet": { "name": "Claude 4.5 Sonnet (Windsurf)" }
      }
    }
  }
}
```

### 4. Multi-Provider Quick Start

Enable all three providers simultaneously by setting credentials for each:

```bash
# Set environment variables
export CURSOR_API_KEY=cursor_your_key
export GITHUB_TOKEN=your_github_token
export WINDSURF_TOKEN=your_windsurf_token

# Start with all providers active
llm-bridge start
```

Or configure them in `~/.config/llm-bridge/config.json`:

```json
{
  "defaultPlugin": "cursor",
  "plugins": {
    "cursor": { "CURSOR_API_KEY": "cursor_..." },
    "copilot": { "GITHUB_TOKEN": "ghp_..." },
    "windsurf": { "WINDSURF_TOKEN": "windsurf_..." }
  }
}
```

Model IDs use a `provider/model` prefix format:

- `cursor/composer-2` — Cursor Composer
- `copilot/gpt-4o-copilot` — GitHub Copilot GPT-4o
- `windsurf/claude-4.5-sonnet` — Windsurf Claude

### 5. Verify your setup

```bash
# Check health
curl http://127.0.0.1:3849/health
# {"status":"ok"}

# List available models
curl http://127.0.0.1:3849/v1/models
# {"data": [{"id": "cursor/composer-2", ...}, {"id": "copilot/gpt-4o-copilot", ...}, ...]}

# Test a chat completion
curl http://127.0.0.1:3849/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cursor/composer-2",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": false
  }'
```

## Provider Setup

For detailed provider configuration, authentication, and model catalogs, see the [CLI Reference](cli-reference.md).

Quick overview:

| Provider       | Auth                                                                       | Models                                                                                                                        |
| -------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Cursor         | API key from [Cursor dashboard](https://cursor.com/dashboard/cloud-agents) | `composer-2`, `composer-fast`, `claude-3.5-sonnet`, `gpt-4o`                                                                  |
| GitHub Copilot | GitHub token with Copilot access                                           | `gpt-4o-copilot`, `claude-3.5-sonnet-copilot`                                                                                 |
| Windsurf       | Windsurf token (OAuth or direct)                                           | `claude-4.5-sonnet`, `claude-4.5-opus`, `gpt-5.2`, `gpt-5.2-codex`, `gpt-4o`, `gemini-3.0-pro`, `gemini-3.0-flash`, `swe-1.5` |

## Running as a Service

### macOS (LaunchAgent)

```bash
llm-bridge install-daemon
```

This creates a LaunchAgent that starts llm-bridge at login. Logs at `~/Library/Logs/llm-bridge.log`.

```bash
llm-bridge uninstall-daemon  # Remove
```

### Docker

```bash
docker run -d \
  --name llm-bridge \
  -p 3849:3849 \
  -e CURSOR_API_KEY=cursor_your_key \
  ghcr.io/aeswibon/llm-bridge:latest
```

Multiple providers:

```bash
docker run -d \
  --name llm-bridge \
  -p 3849:3849 \
  -e CURSOR_API_KEY=cursor_your_key \
  -e GITHUB_TOKEN=your_github_token \
  -e WINDSURF_TOKEN=your_windsurf_token \
  ghcr.io/aeswibon/llm-bridge:latest
```

For production deployment options, see [Deployment](deployment.md).

## Configuration

Config file: `~/.config/llm-bridge/config.json`

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

**Note:** `activePlugin` has been renamed to `defaultPlugin`. The old key still works but is deprecated.

### Environment Variables

All config values can be overridden:

| Variable                        | Description                      |
| ------------------------------- | -------------------------------- |
| `LLM_BRIDGE_PORT`               | Server port (default: 3849)      |
| `LLM_BRIDGE_HOST`               | Server host (default: 127.0.0.1) |
| `LLM_BRIDGE_CONFIG`             | Full config as JSON string       |
| `CURSOR_API_KEY`                | Cursor API key                   |
| `GITHUB_TOKEN`                  | GitHub token for Copilot         |
| `WINDSURF_TOKEN`                | Windsurf token                   |
| `WINDSURF_LANGUAGE_SERVER_PATH` | Custom Windsurf daemon path      |

For full configuration options, see [Configuration](configuration.md).

## CLI Reference

| Command                       | Description                          |
| ----------------------------- | ------------------------------------ |
| `llm-bridge init`             | Interactive setup wizard             |
| `llm-bridge start`            | Launch bridge server                 |
| `llm-bridge configure`        | Inject provider config into OpenCode |
| `llm-bridge doctor`           | Run diagnostics                      |
| `llm-bridge install-daemon`   | Install macOS LaunchAgent            |
| `llm-bridge uninstall-daemon` | Remove macOS LaunchAgent             |
| `llm-bridge daemon status`    | Check Windsurf daemon status         |
| `llm-bridge daemon download`  | Download Windsurf daemon             |
| `llm-bridge daemon locate`    | Find Windsurf daemon path            |

For the complete CLI reference, see [CLI Reference](cli-reference.md).

## API Reference

### Health Check

```
GET /health
```

Response: `{"status": "ok"}`

### List Models

```
GET /v1/models
```

Response:

```json
{
  "data": [
    { "id": "cursor/composer-2", "object": "model", "created": 0, "owned_by": "cursor" },
    { "id": "copilot/gpt-4o-copilot", "object": "model", "created": 0, "owned_by": "copilot" },
    { "id": "windsurf/claude-4.5-sonnet", "object": "model", "created": 0, "owned_by": "windsurf" }
  ]
}
```

### Chat Completions

```
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "cursor/composer-2",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": true
}
```

Response: SSE stream of OpenAI-compatible chunks.

## Next Steps

- Read [Architecture](architecture.md) for system design details
- Read [Plugin Development](plugin-development.md) to build your own provider
- Read [CLI Reference](cli-reference.md) for all commands
- Read [Deployment](deployment.md) for production setups
- Read [Configuration](configuration.md) for all config options
- Check [Troubleshooting](troubleshooting.md) for common issues
