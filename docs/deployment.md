# Deployment Guide

## npm (Recommended)

```bash
npm install -g llm-bridge
```

**Config location:** `~/.config/llm-bridge/config.json`
**Logs:** stderr (redirect with `llm-bridge start > /dev/null 2> llm-bridge.log`)

**Start at login (macOS):**
```bash
llm-bridge install-daemon
```

**Start at login (Linux):**
Create a systemd service at `~/.config/systemd/user/llm-bridge.service`:
```ini
[Unit]
Description=LLM Bridge
After=network.target

[Service]
ExecStart=/usr/bin/llm-bridge start
Restart=always
Environment=PATH=/usr/bin:/usr/local/bin

[Install]
WantedBy=default.target
```

Then: `systemctl --user enable --now llm-bridge`

---

## Docker

### Single Provider

```bash
docker run -d \
  --name llm-bridge \
  -p 3849:3849 \
  -e CURSOR_API_KEY=cursor_your_key \
  ghcr.io/aeswibon/llm-bridge:latest
```

### Multiple Providers

```bash
docker run -d \
  --name llm-bridge \
  -p 3849:3849 \
  -e CURSOR_API_KEY=cursor_your_key \
  -e GITHUB_TOKEN=your_github_token \
  -e WINDSURF_TOKEN=your_windsurf_token \
  ghcr.io/aeswibon/llm-bridge:latest
```

### Docker Compose — Cursor

```yaml
services:
  llm-bridge:
    image: ghcr.io/aeswibon/llm-bridge:latest
    container_name: llm-bridge
    ports:
      - "3849:3849"
    environment:
      - CURSOR_API_KEY=${CURSOR_API_KEY}
    restart: unless-stopped
```

### Docker Compose — Copilot

```yaml
services:
  llm-bridge:
    image: ghcr.io/aeswibon/llm-bridge:latest
    container_name: llm-bridge
    ports:
      - "3849:3849"
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    restart: unless-stopped
```

### Docker Compose — Windsurf

```yaml
services:
  llm-bridge:
    image: ghcr.io/aeswibon/llm-bridge:latest
    container_name: llm-bridge
    ports:
      - "3849:3849"
    environment:
      - WINDSURF_TOKEN=${WINDSURF_TOKEN}
    volumes:
      - ~/.llm-bridge:/root/.llm-bridge
    restart: unless-stopped
```

The volume mount is required for Windsurf to persist the downloaded daemon binary.

### Docker Compose — All Providers

```yaml
services:
  llm-bridge:
    image: ghcr.io/aeswibon/llm-bridge:latest
    container_name: llm-bridge
    ports:
      - "3849:3849"
    environment:
      - CURSOR_API_KEY=${CURSOR_API_KEY}
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - WINDSURF_TOKEN=${WINDSURF_TOKEN}
    volumes:
      - ~/.llm-bridge:/root/.llm-bridge
    restart: unless-stopped
```

### Docker Environment Variables

All config values can be set via environment variables:

| Variable | Description |
|----------|-------------|
| `LLM_BRIDGE_PORT` | Server port (default: 3849) |
| `LLM_BRIDGE_HOST` | Server host (default: 127.0.0.1) |
| `CURSOR_API_KEY` | Cursor API key |
| `GITHUB_TOKEN` | GitHub token for Copilot |
| `WINDSURF_TOKEN` | Windsurf token |
| `WINDSURF_LANGUAGE_SERVER_PATH` | Custom Windsurf daemon path |

---

## Homebrew (macOS)

```bash
brew tap aeswibon/llm-bridge-homebrew
brew install llm-bridge
```

**Setup:**
```bash
llm-bridge init
llm-bridge start
```

**Auto-start:**
```bash
llm-bridge install-daemon
```

---

## Binary Download

Download from [GitHub Releases](https://github.com/aeswibon/llm-bridge/releases/latest):

### macOS Apple Silicon

```bash
curl -sL https://github.com/aeswibon/llm-bridge/releases/latest/download/llm-bridge-macos-arm64 -o llm-bridge
chmod +x llm-bridge
sudo mv llm-bridge /usr/local/bin/
```

### macOS Intel

```bash
curl -sL https://github.com/aeswibon/llm-bridge/releases/latest/download/llm-bridge-macos-x64 -o llm-bridge
chmod +x llm-bridge
sudo mv llm-bridge /usr/local/bin/
```

### Linux x64

```bash
curl -sL https://github.com/aeswibon/llm-bridge/releases/latest/download/llm-bridge-linux-x64 -o llm-bridge
chmod +x llm-bridge
sudo mv llm-bridge /usr/local/bin/
```

**Setup:**
```bash
llm-bridge init
llm-bridge start
```
