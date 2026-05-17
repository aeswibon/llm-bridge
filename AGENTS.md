# AGENTS.md — llm-bridge Context

## Project Overview

`llm-bridge` is a monorepo that bridges AI IDE model catalogs (Cursor, Copilot, Windsurf) to OpenAI-compatible HTTP APIs. Clients like any OpenAI-compatible tool can route requests through llm-bridge to use AI IDE models.

## Architecture

```
Client (OpenAI-compatible)
    ↓ HTTP /v1/chat/completions
llm-bridge Server (packages/core)
    ↓ Plugin interface
Plugin (packages/cursor, packages/copilot, ...)
    ↓ IDE SDK
AI IDE (Cursor, Copilot, Windsurf)
```

## Monorepo Structure

```
llm-bridge/
├── packages/
│   ├── core/          # HTTP server, session, parser, formatter, registry, config
│   ├── cursor/        # Cursor API plugin (reference implementation)
│   └── mcp/           # MCP server for AI IDE integration
├── cli/               # Standalone CLI (llm-bridge binary via pkg)
│   └── src/commands/  # init, start, configure, doctor, daemon
├── .github/workflows/ # CI/CD (pr-build.yml, release.yml)
├── docs/              # Architecture, troubleshooting, examples
└── examples/          # Usage examples (opencode.json, opencode.yaml)
```

## Key Interfaces

### BridgePlugin (`packages/core/src/types.ts`)

```typescript
interface BridgePlugin {
  name: string;
  version: string;
  authenticate(config: Record<string, unknown>): Promise<boolean>;
  listModels(config: Record<string, unknown>): Promise<ModelInfo[]>;
  createSession(config: Record<string, unknown>, model?: string): Promise<BridgeSession>;
}
```

### BridgeSession

```typescript
interface BridgeSession {
  send(messages: Message[], tools?: Tool[]): AsyncIterable<StreamChunk>;
  dispose(): Promise<void>;
}
```

### StreamChunk

```typescript
type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_call'; name: string; input: string }
  | { type: 'error'; error: string }
  | { type: 'done'; finishReason: string };
```

## Conventions

- **Code style:** Prettier (single quotes, no semicolons, 2-space indent)
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`)
- **GPG signing:** All commits must be signed (`commit.gpgsign true`)
- **Testing:** vitest, one test file per source file in `test/` directory
- **Build:** TypeScript (`tsc`), output to `dist/`
- **Package manager:** pnpm 9.0.0 (defined in `packageManager` field)

## Testing

```bash
pnpm test              # All packages (45 tests)
pnpm test --filter @ai-ide-bridge/core  # Single package
```

Mock plugins implement `BridgePlugin` and `BridgeSession` with hardcoded responses. Tests use `port: 0` for dynamic port allocation.

## CI/CD Pipeline

### PR Build (pr-build.yml)

1. Format check (Prettier)
2. Lint + Typecheck
3. Tests on Node 18, 20, 22
4. Snapshot build (pnpm pack)

### Release (release.yml) — Triggered by `v*` tags

1. Build binaries (pkg) for macOS arm64/x64, Linux x64
2. Publish 4 packages to npm
3. Build + push Docker image (linux/amd64, linux/arm64)
4. Create GitHub Release with artifacts
5. Update Homebrew tap

## Common Pitfalls

1. **`crypto is not defined`** — Must import `crypto` from `node:crypto` explicitly (not global in vitest)
2. **`pnpm pack --filter`** — Not supported; use `pnpm pack` with `working-directory:` instead
3. **`__dirname` in ESM** — Use `import.meta.url` + `fileURLToPath` (fixed in `daemon.ts`)
4. **GPG signatures** — `filter-branch` strips signatures; re-sign with `git filter-branch --commit-filter 'git commit-tree -S "$@"'`
5. **Branch protection** — Requires verified signatures + PR workflow; force push needs admin bypass

## Phase 2 Implementation Plan

### 1. Copilot Plugin

- Create `packages/copilot/` following `packages/cursor/` structure
- Implement GitHub OAuth flow for authentication
- Map Copilot model catalog to `ModelInfo[]`
- Add tests with mock Copilot API responses

### 2. Linux systemd Daemon

- Update `cli/src/commands/daemon.ts` to detect Linux
- Generate systemd unit file template
- Add `systemctl enable/disable/start/stop` commands
- Test with mock systemd (no actual systemctl in tests)

### 3. OAuth Support

- Add generic OAuth helper to `@ai-ide-bridge/core`
- Support authorization code flow with PKCE
- Store tokens securely (keychain on macOS, libsecret on Linux)
- Update plugin interface to support OAuth config

## Dependencies

- Node.js 18+ (tested on 18, 20, 22)
- pnpm 9.0.0
- Turbo 2.9.14
- vitest 2.1.9
- TypeScript 5.x
- @yao-pkg/pkg (for binary builds)

## Useful URLs

- Repo: https://github.com/aeswibon/llm-bridge
- PR #2: https://github.com/aeswibon/llm-bridge/pull/2
- Dependabot: https://github.com/aeswibon/llm-bridge/security/dependabot
