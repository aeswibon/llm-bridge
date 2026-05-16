import { loadConfig, saveConfig, BridgeConfig } from "@llm-bridge/core";

export function readConfig(): BridgeConfig {
  return loadConfig();
}

export function writeConfig(config: BridgeConfig): void {
  saveConfig(config);
}

export function setPluginConfig(pluginName: string, envVars: Record<string, string>): void {
  const config = readConfig();
  config.plugins[pluginName] = { ...config.plugins[pluginName], ...envVars };
  config.activePlugin = pluginName;
  writeConfig(config);
}
