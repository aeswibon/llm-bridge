import { findOpencodeConfig, injectProvider } from '../utils/opencode.js';
import { readConfig } from '../utils/config.js';
import { createInterface } from 'node:readline';
import { CursorBridgePlugin } from '../plugins/cursor/index.js';
import { CopilotBridgePlugin } from '../plugins/copilot/index.js';
import { WindsurfBridgePlugin } from '../plugins/windsurf/index.js';

const PROVIDER_PLUGINS: Record<
  string,
  new () => {
    name: string;
    listModels(config: Record<string, string>): Promise<{ id: string; name: string }[]>;
  }
> = {
  cursor: CursorBridgePlugin,
  copilot: CopilotBridgePlugin,
  windsurf: WindsurfBridgePlugin,
};

export async function configureOpencodeCommand(): Promise<void> {
  const configPath = findOpencodeConfig();
  if (!configPath) {
    console.error('No opencode.json found. Create one at ~/.config/opencode/opencode.json');
    process.exit(1);
  }

  const bridgeConfig = readConfig();
  const configuredPlugins = Object.keys(bridgeConfig.plugins || {});

  if (configuredPlugins.length === 0) {
    console.error('No plugins configured. Run `llm-bridge init` first.');
    process.exit(1);
  }

  const allSelectedModels: Record<string, { name: string }> = {};
  let firstSelectedModelId: string | null = null;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

  for (const pluginName of configuredPlugins) {
    const PluginClass = PROVIDER_PLUGINS[pluginName];
    if (!PluginClass) {
      console.warn(`Skipping unknown provider: ${pluginName}`);
      continue;
    }

    const plugin = new PluginClass();
    const pluginConfig = bridgeConfig.plugins[pluginName];

    let models: { id: string; name: string }[];
    try {
      models = await plugin.listModels(pluginConfig);
    } catch (e) {
      console.warn(
        `Failed to list models for ${pluginName}: ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    if (models.length === 0) {
      console.warn(`No models available for ${pluginName}.`);
      continue;
    }

    console.log(`\nModels available for ${pluginName}:`);
    models.forEach((m, i) => {
      console.log(`  ${i + 1}) ${pluginName}/${m.id}`);
    });

    const input = await ask(`Select models (comma-separated numbers, 'all', or 'skip'): `);

    let selectedIndices: number[] = [];

    if (input.toLowerCase() === 'all') {
      selectedIndices = models.map((_, i) => i);
    } else if (input.toLowerCase() === 'skip') {
      continue;
    } else {
      selectedIndices = input
        .split(',')
        .map((s) => parseInt(s.trim(), 10) - 1)
        .filter((i) => i >= 0 && i < models.length);
    }

    if (selectedIndices.length === 0) {
      console.log(`No models selected for ${pluginName}. Skipping.`);
      continue;
    }

    for (const idx of selectedIndices) {
      const model = models[idx];
      const qualifiedId = `${pluginName}/${model.id}`;
      allSelectedModels[qualifiedId] = { name: qualifiedId };
      if (!firstSelectedModelId) {
        firstSelectedModelId = qualifiedId;
      }
    }
  }

  rl.close();

  if (Object.keys(allSelectedModels).length === 0) {
    console.error('No models selected. Run `llm-bridge configure` again to try again.');
    process.exit(1);
  }

  const providerId = 'llm-bridge';
  injectProvider(
    configPath,
    providerId,
    allSelectedModels,
    bridgeConfig.port,
    firstSelectedModelId!,
  );

  const modelCount = Object.keys(allSelectedModels).length;
  console.log(`\nInjected provider into ${configPath}`);
  console.log(`Provider: ${providerId}, Models: ${modelCount}, Default: ${firstSelectedModelId}`);
}
