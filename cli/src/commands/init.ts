import { setPluginConfig, writeConfig, readConfig } from '../utils/config.js';
import { CursorBridgePlugin } from '../plugins/cursor/index.js';
import { CopilotBridgePlugin } from '../plugins/copilot/index.js';
import { WindsurfBridgePlugin } from '../plugins/windsurf/index.js';
import { createInterface } from 'node:readline';
import { stdin as processStdin, stdout as processStdout } from 'node:process';
import { loginCommand } from './login.js';

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
      return 'Enter your GITHUB_TOKEN (or leave empty for OAuth): ';
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

async function authenticateWithOAuth(provider: Provider): Promise<boolean> {
  if (provider === 'copilot') {
    await loginCommand('copilot');
    return true;
  }
  console.log(`OAuth not available for ${provider}. Use token authentication instead.`);
  return false;
}

async function askHidden(prompt: string): Promise<string> {
  return new Promise<string>((resolve) => {
    const stdin = processStdin;
    const stdout = processStdout;

    stdout.write(prompt);

    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();

    let input = '';

    const onData = (data: Buffer) => {
      const char = data.toString();
      if (char === '\r' || char === '\n') {
        stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(input);
      } else if (char === '\x7f' || char === '\b') {
        if (input.length > 0) {
          input = input.slice(0, -1);
          stdout.write('\b \b');
        }
      } else if (char === '\x03') {
        stdin.setRawMode(wasRaw);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.exit(1);
      } else {
        input += char;
        stdout.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

function createAsk() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask: (q: string) => new Promise<string>((resolve) => rl.question(q, resolve)),
    close: () => rl.close(),
  };
}

export async function initCommand(): Promise<void> {
  let { ask, close } = createAsk();

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

    if (provider === 'copilot') {
      const method = await ask('Auth method (token/oauth): ');
      if (method.toLowerCase() === 'oauth') {
        const ok = await authenticateWithOAuth(provider);
        if (!ok) continue;
        console.log(`Authentication successful for ${provider}.`);
        setPluginConfig(provider, { COPILOT_OAUTH: 'true' });
        configuredProviders.push(provider);
        if (!firstProvider) firstProvider = provider;
        const more = await ask('Configure another provider? (y/n): ');
        if (more.toLowerCase() !== 'y') break;
        continue;
      }
    }

    const envVar = getEnvVar(provider);

    close();
    const credential = await askHidden(getCredentialPrompt(provider));
    const { ask: newAsk, close: newClose } = createAsk();
    ask = newAsk;
    close = newClose;

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
  close();
}
