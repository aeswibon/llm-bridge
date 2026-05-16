# Contributing to llm-bridge

## Adding a New Provider

1. Create a new package: `packages/<provider>/`
2. Implement the `BridgePlugin` interface from `@llm-bridge/core`
3. Write tests for auth, models, and sessions
4. Submit a PR with the plugin

## Plugin Contract

```typescript
interface BridgePlugin {
  name: string;
  version: string;
  authenticate(config: Record<string, string>): Promise<boolean>;
  listModels(config: Record<string, string>): Promise<ModelInfo[]>;
  createSession(config: Record<string, string>, model: string): Promise<BridgeSession>;
}
```

## Development Setup

```bash
pnpm install
pnpm build
pnpm test
```

## PR Guidelines

- One provider per PR
- Include tests
- Update README supported providers table
