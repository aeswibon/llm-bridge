import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BridgeConfig, DefaultConfig } from './types.js';

export function configPath(): string {
  const home = os.homedir();
  return path.join(home, '.config', 'llm-bridge', 'config.json');
}

export function loadConfig(): BridgeConfig {
  const envPort = process.env.LLM_BRIDGE_PORT;
  const envHost = process.env.LLM_BRIDGE_HOST;

  try {
    const filePath = process.env.LLM_BRIDGE_CONFIG ?? configPath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const fileConfig = JSON.parse(raw) as Partial<BridgeConfig>;
      const config = { ...DefaultConfig, ...fileConfig };
      if (envPort) config.port = parseInt(envPort, 10);
      if (envHost) config.host = envHost;
      return config;
    }
  } catch (err) {
    console.warn('[llm-bridge] failed to load config file, using defaults:', err);
  }

  const config = { ...DefaultConfig };
  if (envPort) config.port = parseInt(envPort, 10);
  if (envHost) config.host = envHost;
  return config;
}

export function saveConfig(config: BridgeConfig): void {
  const filePath = configPath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}
