import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function findOpencodeConfig(): string | null {
  const candidates = [
    path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
    path.join(os.homedir(), '.config', 'opencode', 'opencode.jsonc'),
    path.join(process.cwd(), 'opencode.json'),
    path.join(process.cwd(), 'opencode.jsonc'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function injectProvider(
  configPath: string,
  providerId: string,
  models: Record<string, { name: string }>,
  port: number,
  defaultModelId: string,
): void {
  const raw = fs.readFileSync(configPath, 'utf8');
  let config: any;
  try {
    config = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse ${configPath}: ${(e as Error).message}`);
  }
  if (!config.provider) config.provider = {};
  config.provider[providerId] = {
    npm: '@ai-sdk/openai-compatible',
    name: 'LLM Bridge',
    options: {
      apiKey: 'bridge-local',
      baseURL: `http://127.0.0.1:${port}/v1`,
    },
    models,
  };
  config.model = `${providerId}/${defaultModelId}`;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
