import { BridgeServer, loadConfig } from '@llm-bridge/core';
import { CursorBridgePlugin } from '@llm-bridge/cursor';
import { CopilotBridgePlugin } from '@llm-bridge/copilot';
import { WindsurfBridgePlugin } from '@llm-bridge/windsurf';

export async function startCommand(): Promise<void> {
  const config = loadConfig();
  const server = new BridgeServer(config);

  if (config.activePlugin === 'cursor') {
    const plugin = new CursorBridgePlugin();
    server.registerPlugin(plugin);
    server.setActivePlugin('cursor');
    console.error(`[llm-bridge] active plugin: cursor`);
  } else if (config.activePlugin === 'copilot') {
    const plugin = new CopilotBridgePlugin();
    server.registerPlugin(plugin);
    server.setActivePlugin('copilot');
    console.error(`[llm-bridge] active plugin: copilot`);
  } else if (config.activePlugin === 'windsurf') {
    const plugin = new WindsurfBridgePlugin();
    server.registerPlugin(plugin);
    server.setActivePlugin('windsurf');
    console.error(`[llm-bridge] active plugin: windsurf`);
  } else {
    console.error(`[llm-bridge] warning: unknown plugin "${config.activePlugin}"`);
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
