import type { BridgePlugin, PluginHealth } from './types.js';

export class PluginRegistry {
  private plugins: Map<string, BridgePlugin> = new Map();
  private activePluginName: string | null = null;
  private defaultPluginName: string | null = null;
  private health: Map<string, PluginHealth> = new Map();

  register(plugin: BridgePlugin): void {
    this.plugins.set(plugin.name, plugin);
    this.health.set(plugin.name, {
      name: plugin.name,
      healthy: true,
      lastChecked: new Date(),
    });
  }

  getPlugin(name: string): BridgePlugin | undefined {
    return this.plugins.get(name);
  }

  setActive(name: string): void {
    if (!this.plugins.has(name)) {
      throw new Error(`Plugin "${name}" is not registered`);
    }
    this.activePluginName = name;
  }

  setDefault(name: string): void {
    if (!this.plugins.has(name)) {
      throw new Error(`Plugin "${name}" is not registered`);
    }
    this.defaultPluginName = name;
  }

  getActivePlugin(): BridgePlugin | null {
    if (!this.activePluginName) return null;
    return this.plugins.get(this.activePluginName) ?? null;
  }

  getDefaultPlugin(): BridgePlugin | null {
    if (!this.defaultPluginName) return null;
    return this.plugins.get(this.defaultPluginName) ?? null;
  }

  listPlugins(): BridgePlugin[] {
    return Array.from(this.plugins.values());
  }

  markUnhealthy(name: string, error: string): void {
    this.health.set(name, {
      name,
      healthy: false,
      lastChecked: new Date(),
      error,
    });
  }

  getHealth(name: string): PluginHealth | undefined {
    return this.health.get(name);
  }
}
