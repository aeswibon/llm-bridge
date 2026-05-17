# @ai-ide-bridge/windsurf

The Windsurf IDE daemon plugin for **AI IDE Bridge**.

AI IDE Bridge is a local HTTP server that translates OpenAI-compatible API requests into provider-specific calls, enabling any OpenAI-format client to use any AI IDE's model catalog.

## Overview

`@ai-ide-bridge/windsurf` provides seamless integration with Windsurf IDE's local language server daemon. It spawns the local Windsurf language server binary and communicates over stdio using JSON-RPC 2.0 to stream chat completions.

## Installation

```bash
npm install @ai-ide-bridge/windsurf
```

## Configuration

The plugin requires a valid `WINDSURF_TOKEN`.

Set the credential via environment variable:

```bash
export WINDSURF_TOKEN="windsurf_your_token"
```

Or configure it in `~/.config/llm-bridge/config.json`:

```json
{
  "plugins": {
    "windsurf": {
      "WINDSURF_TOKEN": "windsurf_your_token"
    }
  }
}
```

### Daemon Management

You can specify a custom path to the Windsurf language server binary:

```bash
export WINDSURF_LANGUAGE_SERVER_PATH="/path/to/language_server"
```

Or download the managed daemon via CLI:

```bash
llm-bridge daemon download
```

## Supported Models

Models are accessible via the `windsurf/` prefix:

- `windsurf/claude-4.5-sonnet` — Claude 4.5 Sonnet (Windsurf)
- `windsurf/claude-4.5-opus` — Claude 4.5 Opus (Windsurf)
- `windsurf/gpt-5.2` — GPT-5.2 (Windsurf)
- `windsurf/gpt-5.2-codex` — GPT-5.2 Codex (Windsurf)
- `windsurf/gpt-4o` — GPT-4o (Windsurf)
- `windsurf/gemini-3.0-pro` — Gemini 3.0 Pro (Windsurf)
- `windsurf/gemini-3.0-flash` — Gemini 3.0 Flash (Windsurf)
- `windsurf/swe-1.5` — SWE 1.5 (Windsurf)

## Documentation

For full documentation and setup instructions, please visit the main repository: [https://github.com/aeswibon/llm-bridge](https://github.com/aeswibon/llm-bridge).

## License

MIT
