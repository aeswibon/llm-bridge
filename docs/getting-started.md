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
- Ask which provider you want to use (cursor, copilot, windsurf)
- Collect your API token
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
      "name": "llm-bridge",
      "baseURL": "http://127.0.0.1:3849",
      "apiKey": "placeholder",
      "models": {
        "composer-2": { "name": "composer-2" }
      }
    }
  }
}
```

### 4. Verify

```bash
curl http://127.0.0.1:3849/health
# {"status":"ok"}

curl http://127.0.0.1:3849/v1/models
# {"data": [{"id": "composer-2", ...}]}
```

## Provider Setup

### Cursor

**Auth:** API key from [Cursor dashboard](https://cursor.com/dashboard/cloud-agents)

```bash
# During init, select "cursor" and paste your API key
llm-bridge init

# Or set manually in config
# ~/.config/llm-bridge/config.json
{
  "activePlugin": "cursor",
  "plugins": {
    "cursor": {
      "CURSOR_API_KEY": "cursor_your_key_here"
    }
  }
}
```

**Available models:** `composer-2`, `composer-fast`, `claude-3.5-sonnet`, `gpt-4o`

### GitHub Copilot

**Auth:** GitHub token with Copilot access

```bash
# During init, select "copilot" and enter your GitHub token
llm-bridge init

# Or set via environment variable
export GITHUB_TOKEN=your_github_token
```

**Available models:** `gpt-4o-copilot`, `claude-3.5-sonnet-copilot`

### Windsurf

**Auth:** Windsurf token (OAuth or direct)

```bash
# During init, select "windsurf" and enter your token
llm-bridge init

# Or set via environment variable
export WINDSURF_TOKEN=your_windsurf_token
```

**Available models:** `claude-4.5-sonnet`, `claude-4.5-opus`, `gpt-5.2`, `gpt-5.2-codex`, `gpt-4o`, `gemini-3.0-pro`, `gemini-3.0-flash`, `swe-1.5`

**Daemon management:**

Windsurf uses a local language server daemon. llm-bridge will automatically find it if Windsurf is installed.

```bash
# Check if daemon is found
llm-bridge daemon status

# Download daemon manually
llm-bridge daemon download

# Show daemon path
llm-bridge daemon locate
```

The daemon is searched for in this order:
1. `WINDSURF_LANGUAGE_SERVER_PATH` environment variable
2. macOS default: `/Applications/Windsurf.app/Contents/Resources/language_server`
3. `~/.llm-bridge/daemons/language_server` (downloaded)

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

## Configuration

Config file: `~/.config/llm-bridge/config.json`

```json
{
  "activePlugin": "cursor",
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

### Environment Variables

All config values can be overridden:

| Variable | Description |
|----------|-------------|
| `LLM_BRIDGE_PORT` | Server port (default: 3849) |
| `LLM_BRIDGE_HOST` | Server host (default: 127.0.0.1) |
| `LLM_BRIDGE_CONFIG` | Full config as JSON string |
| `CURSOR_API_KEY` | Cursor API key |
| `GITHUB_TOKEN` | GitHub token for Copilot |
| `WINDSURF_TOKEN` | Windsurf token |
| `WINDSURF_LANGUAGE_SERVER_PATH` | Custom Windsurf daemon path |

## CLI Reference

| Command | Description |
|---------|-------------|
| `llm-bridge init` | Interactive setup wizard |
| `llm-bridge start` | Launch bridge server |
| `llm-bridge configure` | Inject provider config into OpenCode |
| `llm-bridge doctor` | Run diagnostics |
| `llm-bridge install-daemon` | Install macOS LaunchAgent |
| `llm-bridge uninstall-daemon` | Remove macOS LaunchAgent |
| `llm-bridge daemon status` | Check Windsurf daemon status |
| `llm-bridge daemon download` | Download Windsurf daemon |
| `llm-bridge daemon locate` | Find Windsurf daemon path |

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
    { "id": "composer-2", "object": "model", "created": 0, "owned_by": "cursor" }
  ]
}
```

### Chat Completions

```
POST /v1/chat/completions
Content-Type: application/json

{
  "model": "composer-2",
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
- Check [Troubleshooting](troubleshooting.md) for common issues
