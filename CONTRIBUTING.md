# Contributing to llm-bridge

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Adding a New Provider](#adding-a-new-provider)
- [The Plugin Contract](#the-plugin-contract)
- [Code Conventions](#code-conventions)
- [Commit Messages](#commit-messages)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Issues](#reporting-issues)

## Development Setup

```bash
# Clone the repo
git clone https://github.com/anomalyco/llm-bridge.git
cd llm-bridge

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run a single package's tests
cd packages/core && pnpm test
```

### Project Structure

```
llm-bridge/
├── packages/
│   ├── core/           # @ai-ide-bridge/core — HTTP server, plugin registry
│   ├── cursor/         # @ai-ide-bridge/cursor — Cursor SDK plugin
│   └── mcp/            # @ai-ide-bridge/mcp — MCP server for Cursor IDE
├── cli/                # @ai-ide-bridge/cli — CLI tool
├── docs/               # Architecture, plugin dev guide, troubleshooting
├── examples/           # OpenCode config, docker-compose
└── scripts/            # Build scripts
```

## Adding a New Provider

1. Create a new package: `packages/<provider>/`
2. Add it to `pnpm-workspace.yaml`
3. Implement the `BridgePlugin` interface (see below)
4. Write tests for `authenticate()`, `listModels()`, and `createSession()`
5. Update the supported providers table in `README.md`
6. Submit a PR

## The Plugin Contract

Every provider implements this interface from `@ai-ide-bridge/core`:

```typescript
interface BridgePlugin {
  name: string;
  version: string;
  authenticate(config: Record<string, string>): Promise<boolean>;
  listModels(config: Record<string, string>): Promise<ModelInfo[]>;
  createSession(config: Record<string, string>, model: string): Promise<BridgeSession>;
}

interface BridgeSession {
  send(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk>;
  dispose(): Promise<void>;
}
```

See [docs/plugin-development.md](docs/plugin-development.md) for a complete guide with examples.

## Code Conventions

- **TypeScript** — strict mode, NodeNext modules
- **ESM** — all imports use `.js` extension
- **TDD** — write tests before implementation
- **YAGNI** — don't add features that aren't requested
- **Single responsibility** — each file does one thing

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add session store with TTL cleanup
fix(cursor): handle SDK API mismatch in Agent.create
docs: add architecture and troubleshooting guides
test(core): add E2E integration test with mock plugin
chore: clean up legacy files
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`

## Pull Request Guidelines

- **One feature per PR** — provider additions, bug fixes, docs, etc.
- **Include tests** — all new code must have test coverage
- **Update docs** — README, plugin list, architecture if relevant
- **Pass CI** — all checks must pass before merge
- **Squash merge** — keep history clean

### PR Checklist

- [ ] Tests added/updated
- [ ] `pnpm test` passes locally
- [ ] `pnpm build` passes locally
- [ ] README updated (if adding provider)
- [ ] No lint/typecheck errors

## Reporting Issues

When filing a bug, include:

- **llm-bridge version** (`llm-bridge help`)
- **Node.js version** (`node --version`)
- **OS** (macOS, Linux, Windows)
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Logs** (run `llm-bridge doctor` and share output)

For feature requests, describe the use case and which provider it applies to.

## Questions?

Open a [GitHub Discussion](https://github.com/anomalyco/llm-bridge/discussions) or file an issue.
