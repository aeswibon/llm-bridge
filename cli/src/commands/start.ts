import { BridgeServer, loadConfig } from "@llm-bridge/core";
import { CursorBridgePlugin } from "@llm-bridge/cursor";

export async function startCommand(): Promise<void> {
  const config = loadConfig();
  const server = new BridgeServer(config);

  if (config.activePlugin === "cursor") {
    const plugin = new CursorBridgePlugin();
    server.registerPlugin(plugin);
    server.setActivePlugin("cursor");
    console.error(`[llm-bridge] active plugin: cursor`);
  } else {
    console.error(`[llm-bridge] warning: unknown plugin "${config.activePlugin}"`);
  }

  await server.start();

  process.on("SIGINT", async () => {
    console.error("\n[llm-bridge] shutting down...");
    await server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.error("\n[llm-bridge] shutting down...");
    await server.stop();
    process.exit(0);
  });
}
