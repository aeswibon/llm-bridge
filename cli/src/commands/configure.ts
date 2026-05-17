import { findOpencodeConfig, injectProvider } from '../utils/opencode.js';
import { readConfig } from '../utils/config.js';

export async function configureOpencodeCommand(): Promise<void> {
  const configPath = findOpencodeConfig();
  if (!configPath) {
    console.error('No opencode.json found. Create one at ~/.config/opencode/opencode.json');
    process.exit(1);
  }

  const bridgeConfig = readConfig();
  const providerId = 'llm-bridge';
  const plugin = bridgeConfig.activePlugin ?? 'cursor';
  const modelId =
    plugin === 'copilot'
      ? 'gpt-4o-copilot'
      : plugin === 'windsurf'
        ? 'claude-4.5-sonnet'
        : 'composer-2';

  injectProvider(configPath, providerId, modelId, bridgeConfig.port);
  console.log(`Injected provider into ${configPath}`);
  console.log(`Provider: ${providerId}, Model: ${modelId}, Port: ${bridgeConfig.port}`);
  console.log(`Plugin: ${plugin}`);
}
