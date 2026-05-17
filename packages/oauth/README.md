# @ai-ide-bridge/oauth

The OAuth authentication helper package for **AI IDE Bridge**.

AI IDE Bridge is a local HTTP server that translates OpenAI-compatible API requests into provider-specific calls, enabling any OpenAI-format client to use any AI IDE's model catalog.

## Overview

`@ai-ide-bridge/oauth` provides generic OAuth 2.0 authorization code flow and device code flow support for AI IDE bridge plugins. It handles token exchange, secure storage, and token refreshing.

## Installation

```bash
npm install @ai-ide-bridge/oauth
```

## Features

- **Device Authorization Flow**: Seamless CLI/TUI browser authorization.
- **Authorization Code Flow with PKCE**: Secure authentication for desktop/daemon integrations.
- **Token Management**: Secure credential storage and automatic token refreshing.

## Documentation

For full documentation and integration guides, please visit the main repository: [https://github.com/aeswibon/llm-bridge](https://github.com/aeswibon/llm-bridge).

## License

MIT
