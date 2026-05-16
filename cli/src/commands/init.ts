import { setPluginConfig, writeConfig } from '../utils/config.js';
import { CursorBridgePlugin } from '@llm-bridge/cursor';
import { createInterface } from 'node:readline';

export async function initCommand(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

  console.log('llm-bridge setup wizard\n');

  const provider = (await ask(`Provider (default: cursor): `)) || 'cursor';

  if (provider === 'cursor') {
    const apiKey = await ask('Enter your CURSOR_API_KEY: ');
    if (!apiKey) {
      console.error('API key is required.');
      rl.close();
      process.exit(1);
    }

    setPluginConfig('cursor', { CURSOR_API_KEY: apiKey });

    const plugin = new CursorBridgePlugin();
    const valid = await plugin.authenticate({ CURSOR_API_KEY: apiKey });
    if (!valid) {
      console.error('Invalid API key. Please check and try again.');
      rl.close();
      process.exit(1);
    }
    console.log('API key validated successfully.');
  }

  writeConfig({
    activePlugin: provider,
    port: 3849,
    host: '127.0.0.1',
    plugins: {},
    sessionTTL: 1800,
    toolMode: 'lenient',
  });
  console.log(`\nConfig saved. Run 'llm-bridge start' to launch.`);
  rl.close();
}
