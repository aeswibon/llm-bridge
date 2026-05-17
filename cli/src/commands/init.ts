import { setPluginConfig, writeConfig, readConfig } from '../utils/config.js';
import { CursorBridgePlugin } from '@ai-ide-bridge/cursor';
import { CopilotBridgePlugin } from '@ai-ide-bridge/copilot';
import { WindsurfBridgePlugin } from '@ai-ide-bridge/windsurf';
import { createInterface } from 'node:readline';

const PROVIDERS = ['cursor', 'copilot', 'windsurf'] as const;
type Provider = (typeof PROVIDERS)[number];

async function getProviderPlugin(provider: Provider) {
  switch (provider) {
    case 'cursor':
      return new CursorBridgePlugin();
    case 'copilot':
      return new CopilotBridgePlugin();
    case 'windsurf':
      return new WindsurfBridgePlugin();
  }
}

function getCredentialPrompt(provider: Provider): string {
  switch (provider) {
    case 'cursor':
      return 'Enter your CURSOR_API_KEY: ';
    case 'copilot':
      return 'Enter your GITHUB_TOKEN: ';
    case 'windsurf':
      return 'Enter your WINDSURF_TOKEN: ';
  }
}

function getEnvVar(provider: Provider): string {
  switch (provider) {
    case 'cursor':
      return 'CURSOR_API_KEY';
    case 'copilot':
      return 'GITHUB_TOKEN';
    case 'windsurf':
      return 'WINDSURF_TOKEN';
  }
}

export async function initCommand(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

  console.log('llm-bridge setup wizard\n');

  const existingConfig = readConfig();
  const configuredProviders = Object.keys(existingConfig.plugins || {});
  if (configuredProviders.length > 0) {
    console.log(`Already configured: ${configuredProviders.join(', ')}\n`);
  }

  let firstProvider: Provider | null = null;

  while (true) {
    const available = PROVIDERS.filter((p) => !configuredProviders.includes(p));
    if (available.length === 0) {
      console.log('All providers already configured.');
      break;
    }

    const input = await ask(`Provider to configure (${available.join(', ')}, or 'skip'): `);

    if (input === 'skip' || !PROVIDERS.includes(input as Provider)) {
      break;
    }

    const provider = input as Provider;

    const envVar = getEnvVar(provider);
    const credential = await ask(getCredentialPrompt(provider));
    if (!credential) {
      console.error('Credential is required.');
      continue;
    }

    const plugin = await getProviderPlugin(provider);
    const valid = await plugin.authenticate({ [envVar]: credential });
    if (!valid) {
      console.error('Authentication failed. Please check your credential and try again.');
      continue;
    }
    console.log(`Authentication successful for ${provider}.`);

    setPluginConfig(provider, { [envVar]: credential });
    configuredProviders.push(provider);

    if (!firstProvider) {
      firstProvider = provider;
    }

    const more = await ask('Configure another provider? (y/n): ');
    if (more.toLowerCase() !== 'y') break;
  }

  const config = readConfig();
  if (!config.defaultPlugin && firstProvider) {
    config.defaultPlugin = firstProvider;
    writeConfig(config);
  }

  console.log(`\nConfig saved. Run 'llm-bridge start' to launch.`);
  rl.close();
}
