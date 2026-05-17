import { describe, it, expect, vi } from 'vitest';
import { PluginRegistry } from '../src/registry.js';
import type { BridgePlugin } from '../src/types.js';

function mockPlugin(name: string): BridgePlugin {
  return {
    name,
    version: '1.0.0',
    authenticate: vi.fn().mockResolvedValue(true),
    listModels: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({
      send: async function* () {},
      dispose: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

describe('PluginRegistry', () => {
  it('registers and retrieves plugins', () => {
    const registry = new PluginRegistry();
    const plugin = mockPlugin('test');
    registry.register(plugin);
    expect(registry.getPlugin('test')).toBe(plugin);
  });

  it('returns undefined for unknown plugins', () => {
    const registry = new PluginRegistry();
    expect(registry.getPlugin('nonexistent')).toBeUndefined();
  });

  it('sets active plugin', () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin('cursor'));
    registry.setActive('cursor');
    expect(registry.getActivePlugin()?.name).toBe('cursor');
  });

  it('returns null when no active plugin is set', () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin('cursor'));
    expect(registry.getActivePlugin()).toBeNull();
  });

  it('lists all registered plugins', () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin('cursor'));
    registry.register(mockPlugin('copilot'));
    const names = registry.listPlugins().map((p) => p.name);
    expect(names).toContain('cursor');
    expect(names).toContain('copilot');
  });

  it('throws when setting unknown active plugin', () => {
    const registry = new PluginRegistry();
    expect(() => registry.setActive('nonexistent')).toThrow(
      'Plugin "nonexistent" is not registered',
    );
  });

  it('tracks plugin health', () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin('cursor'));
    const health = registry.getHealth('cursor');
    expect(health).toBeDefined();
    expect(health?.healthy).toBe(true);
  });

  it('marks plugin as unhealthy', () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin('cursor'));
    registry.markUnhealthy('cursor', 'connection failed');
    const health = registry.getHealth('cursor');
    expect(health?.healthy).toBe(false);
    expect(health?.error).toBe('connection failed');
  });

  it('sets default plugin for fallback routing', () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin('cursor'));
    registry.register(mockPlugin('windsurf'));
    registry.setDefault('cursor');
    expect(registry.getDefaultPlugin()?.name).toBe('cursor');
  });

  it('returns null when no default plugin is set', () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin('cursor'));
    expect(registry.getDefaultPlugin()).toBeNull();
  });

  it('throws when setting default to unregistered plugin', () => {
    const registry = new PluginRegistry();
    registry.register(mockPlugin('cursor'));
    expect(() => registry.setDefault('nonexistent')).toThrow(
      'Plugin "nonexistent" is not registered',
    );
  });
});
