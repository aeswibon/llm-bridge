# @ai-ide-bridge/mcp

The Model Context Protocol (MCP) server for **AI IDE Bridge**.

AI IDE Bridge is a local HTTP server that translates OpenAI-compatible API requests into provider-specific calls, enabling any OpenAI-format client to use any AI IDE's model catalog.

## Overview

`@ai-ide-bridge/mcp` implements an MCP server over stdio, enabling direct integration with AI IDEs like Cursor. It exposes bridge status, model catalogs, and client configuration generation as MCP tools.

## Installation

```bash
npm install @ai-ide-bridge/mcp
```

## Usage

Configure the MCP server in your AI IDE (e.g., Cursor MCP settings):

```json
{
  "mcpServers": {
    "llm-bridge": {
      "command": "npx",
      "args": ["-y", "@ai-ide-bridge/mcp"]
    }
  }
}
```

## Available Tools

- `bridge_status` — Check bridge health and active plugins.
- `list_models` — Retrieve available models from all active plugins.
- `generate_opencode_config` — Generate provider configuration fragments for OpenCode.

## Documentation

For full documentation and setup instructions, please visit the main repository: [https://github.com/aeswibon/llm-bridge](https://github.com/aeswibon/llm-bridge).

## License

MIT
