# CLI Reference

## Overview

llm-bridge is a command-line tool that runs a local HTTP server translating OpenAI-compatible API requests into provider-specific calls. All configuration is done via the config file (`~/.config/llm-bridge/config.json`) or environment variables — there are no CLI flags.

## Commands

### `llm-bridge init`

Interactive setup wizard for configuring one or more providers.

**What it does:**
1. Asks which provider to configure (cursor, copilot, windsurf)
2. Collects the required credential for that provider
3. Validates the credential against the provider's API
4. Saves the credential to `~/.config/llm-bridge/config.json`
5. Asks if you want to configure another provider
6. Sets the first configured provider as the `defaultPlugin`

**Prompts:**
```
llm-bridge setup wizard

Provider to configure (cursor, copilot, windsurf, or 'skip'): cursor
Enter your CURSOR_API_KEY: cursor_abc123
Authentication successful for cursor.
Configure another provider? (y/n): y

Provider to configure (copilot, windsurf, or 'skip'): windsurf
Enter your WINDSURF_TOKEN: windsurf_xyz789
Authentication successful for windsurf.
Configure another provider? (y/n): n

Config saved. Run 'llm-bridge start' to launch.
```

**Config output:**
```json
{
  "defaultPlugin": "cursor",
  "port": 3849,
  "host": "127.0.0.1",
  "plugins": {
    "cursor": { "CURSOR_API_KEY": "cursor_abc123" },
    "windsurf": { "WINDSURF_TOKEN": "windsurf_xyz789" }
  },
  "sessionTTL": 1800,
  "toolMode": "lenient"
}
```

**Credential requirements:**
| Provider | Credential | Where to get it |
|----------|-----------|-----------------|
| cursor | `CURSOR_API_KEY` | [cursor.com/dashboard/cloud-agents](https://cursor.com/dashboard/cloud-agents) |
| copilot | `GITHUB_TOKEN` | GitHub Settings > Developer settings > Personal access tokens (needs Copilot scope) |
| windsurf | `WINDSURF_TOKEN` | Windsurf IDE settings or OAuth flow |

---

### `llm-bridge start`

Launch the bridge HTTP server.

**What it does:**
1. Loads config from `~/.config/llm-bridge/config.json`
2. Registers all plugins listed in `config.plugins`
3. Sets the `defaultPlugin` for fallback routing
4. Starts HTTP server on `config.host:config.port` (default: `127.0.0.1:3849`)
5. Listens for SIGINT/SIGTERM for graceful shutdown

**Console output:**
```
[llm-bridge] registered plugin: cursor
[llm-bridge] registered plugin: windsurf
[llm-bridge] default plugin: cursor
[llm-bridge] listening on http://127.0.0.1:3849
```

**Routing behavior:**
- `POST /v1/chat/completions` with `"model": "cursor/composer-2"` → Cursor plugin
- `POST /v1/chat/completions` with `"model": "windsurf/claude-4.5-sonnet"` → Windsurf plugin
- `POST /v1/chat/completions` with `"model": "composer-2"` (no prefix) → defaultPlugin (cursor)

**Error cases:**
| Error | Cause | Fix |
|-------|-------|-----|
| `no plugins configured` | Empty `plugins` in config | Run `llm-bridge init` |
| `port 3849 is already in use` | Another process on the port | Change port in config or kill the other process |
| `unknown plugin "xyz"` | Plugin name not recognized | Check config for typos |

---

### `llm-bridge configure`

Inject llm-bridge provider configuration into OpenCode.

**What it does:**
1. Searches for `opencode.json` in standard locations
2. Adds or updates the `llm-bridge` provider entry
3. Sets the model to the default provider's default model
4. Writes the updated config

**Search locations (in order):**
1. `~/.config/opencode/opencode.json`
2. `~/.config/opencode/opencode.jsonc`
3. `./opencode.json` (current directory)
4. `./opencode.jsonc` (current directory)

**Injected config:**
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
        "cursor/composer-2": { "name": "cursor/composer-2" }
      }
    }
  },
  "model": "llm-bridge/cursor/composer-2"
}
```

---

### `llm-bridge doctor`

Run diagnostic checks.

**Checks performed:**
1. Config file existence and path
2. Active plugin configuration
3. Bridge server connectivity (health endpoint)
4. Port availability

**Sample output:**
```
llm-bridge diagnostics

Config: /Users/me/.config/llm-bridge/config.json
Default plugin: cursor
Port: 3849
Host: 127.0.0.1
Tool mode: lenient
✓ Config file exists
✓ Plugin "cursor" has configuration
✓ Bridge server is running
✓ Port 3849 is available
```

---

### `llm-bridge install-daemon`

Install a macOS LaunchAgent to auto-start llm-bridge at login.

**What it does:**
1. Creates a plist at `~/Library/LaunchAgents/com.llm-bridge.daemon.plist`
2. Points to the llm-bridge binary wrapper script
3. Bootstraps the LaunchAgent via `launchctl`
4. Configures logging to `~/Library/Logs/llm-bridge.log`

**Requirements:** macOS only

---

### `llm-bridge uninstall-daemon`

Remove the macOS LaunchAgent.

**What it does:**
1. Unbootstraps the LaunchAgent via `launchctl`
2. Deletes the plist file

---

### `llm-bridge daemon status`

Check if the Windsurf language server daemon is available.

**Search order:**
1. `WINDSURF_LANGUAGE_SERVER_PATH` environment variable
2. macOS default: `/Applications/Windsurf.app/Contents/Resources/language_server`
3. `~/.llm-bridge/daemons/language_server` (downloaded)

**Output:**
```
Windsurf language server found at: /Applications/Windsurf.app/Contents/Resources/language_server
Health: OK
```

---

### `llm-bridge daemon download`

Download the windsurf language server daemon.

**Downloads to:** `~/.llm-bridge/daemons/language_server`

---

### `llm-bridge daemon locate`

Print the path to the Windsurf language server daemon.

**Output:** The path if found, or `Not found` with exit code 1.

---

### `llm-bridge help`

Show the help text with all available commands.
