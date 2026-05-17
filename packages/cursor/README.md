# @ai-ide-bridge/cursor

The Cursor API plugin for **AI IDE Bridge**.

AI IDE Bridge is a local HTTP server that translates OpenAI-compatible API requests into provider-specific calls, enabling any OpenAI-format client to use any AI IDE's model catalog.

## Overview

`@ai-ide-bridge/cursor` provides seamless integration with Cursor's cloud AI agents. It acts as a plugin for `@ai-ide-bridge/core` and uses the `@cursor/sdk` to authenticate, list models, and stream chat completions.

## Installation

```bash
npm install @ai-ide-bridge/cursor
```

## Configuration

The plugin requires a valid `CURSOR_API_KEY`, which can be obtained from the [Cursor Dashboard](https://cursor.com/dashboard/cloud-agents).

Set the credential via environment variable:

```bash
export CURSOR_API_KEY="cursor_your_api_key"
```

Or configure it in `~/.config/llm-bridge/config.json`:

```json
{
  "plugins": {
    "cursor": {
      "CURSOR_API_KEY": "cursor_your_api_key"
    }
  }
}
```

## Supported Models

Models are accessible via the `cursor/` prefix:

- `cursor/composer-2` — Cursor Composer 2
- `cursor/composer-fast` — Cursor Composer Fast
- `cursor/claude-3.5-sonnet` — Claude 3.5 Sonnet (Cursor)
- `cursor/gpt-4o` — GPT-4o (Cursor)

## Documentation

For full documentation and setup instructions, please visit the main repository: [https://github.com/aeswibon/llm-bridge](https://github.com/aeswibon/llm-bridge).

## License

MIT
