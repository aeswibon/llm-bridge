import { BridgeServer, loadConfig } from '@llm-bridge/core';
import { CursorBridgePlugin } from '@llm-bridge/cursor';
import { CopilotBridgePlugin } from '@llm-bridge/copilot';
import { WindsurfBridgePlugin } from '@llm-bridge/windsurf';

async function getPlugin(name: string) {
  switch (name) {
    case 'cursor':
      return new CursorBridgePlugin();
    case 'copilot':
      return new CopilotBridgePlugin();
    case 'windsurf':
      return new WindsurfBridgePlugin();
    default:
      return null;
  }
}

export async function startCommand(): Promise<void> {
  const config = loadConfig();
  const server = new BridgeServer(config);

  // Register all configured plugins
  const pluginNames = Object.keys(config.plugins);
  if (pluginNames.length === 0) {
    console.error('[llm-bridge] error: no plugins configured. Run: llm-bridge init');
    process.exit(1);
  }

  for (const name of pluginNames) {
    const plugin = await getPlugin(name);
    if (plugin) {
      server.registerPlugin(plugin);
      console.error(`[llm-bridge] registered plugin: ${name}`);
    } else {
      console.error(`[llm-bridge] warning: unknown plugin "${name}"`);
    }
  }

  // Set default plugin for fallback routing
  if (config.defaultPlugin) {
    server.setDefaultPlugin(config.defaultPlugin);
    console.error(`[llm-bridge] default plugin: ${config.defaultPlugin}`);
  }

  try {
    await server.start();
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`[llm-bridge] error: port ${config.port} is already in use`);
    } else {
      console.error(`[llm-bridge] error: ${err.message}`);
    }
    process.exit(1);
  }

  const shutdown = async () => {
    console.error('\n[llm-bridge] shutting down...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
