# @ai-ide-bridge/copilot

The GitHub Copilot API plugin for **AI IDE Bridge**.

AI IDE Bridge is a local HTTP server that translates OpenAI-compatible API requests into provider-specific calls, enabling any OpenAI-format client to use any AI IDE's model catalog.

## Overview

`@ai-ide-bridge/copilot` provides seamless integration with GitHub Copilot's cloud AI models. It acts as a plugin for `@ai-ide-bridge/core` to authenticate, list models, and stream chat completions.

## Installation

```bash
npm install @ai-ide-bridge/copilot
```

## Configuration

The plugin requires a valid `GITHUB_TOKEN` with Copilot access permissions.

Set the credential via environment variable:

```bash
export GITHUB_TOKEN="ghp_your_github_token"
```

Or configure it in `~/.config/llm-bridge/config.json`:

```json
{
  "plugins": {
    "copilot": {
      "GITHUB_TOKEN": "ghp_your_github_token"
    }
  }
}
```

## Supported Models

Models are accessible via the `copilot/` prefix:

- `copilot/gpt-4o-copilot` — GPT-4o (GitHub Copilot)
- `copilot/claude-3.5-sonnet-copilot` — Claude 3.5 Sonnet (GitHub Copilot)

## Documentation

For full documentation and setup instructions, please visit the main repository: [https://github.com/aeswibon/llm-bridge](https://github.com/aeswibon/llm-bridge).

## License

MIT
