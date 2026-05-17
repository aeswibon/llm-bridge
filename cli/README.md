# @ai-ide-bridge/cli

The standalone command-line interface for **AI IDE Bridge**.

AI IDE Bridge is a local HTTP server that translates OpenAI-compatible API requests into provider-specific calls (Cursor SDK, GitHub Copilot, Windsurf), enabling any OpenAI-format client to use any AI IDE's model catalog.

## Installation

```bash
npm install -g @ai-ide-bridge/cli
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

### 2. Start the Bridge

```bash
llm-bridge start
```

The server starts on `http://127.0.0.1:3849` by default.

### 3. Configure your Client

```bash
llm-bridge configure
```

This injects the llm-bridge provider into your `opencode.json`.

## Commands

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

## Documentation

For full documentation, architecture diagrams, and advanced configuration, please visit the main repository: [https://github.com/aeswibon/llm-bridge](https://github.com/aeswibon/llm-bridge).

## License

MIT
