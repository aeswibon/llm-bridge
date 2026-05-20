import { createInterface } from 'node:readline';
import { createTokenStore, DeviceFlow, providers } from '../oauth/index.js';

const SUPPORTED_PROVIDERS = ['copilot', 'cursor'] as const;
type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export async function loginCommand(provider?: string): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

  let providerId: SupportedProvider;

  if (provider && SUPPORTED_PROVIDERS.includes(provider as SupportedProvider)) {
    providerId = provider as SupportedProvider;
  } else {
    const input = await ask(`Provider to login (${SUPPORTED_PROVIDERS.join(', ')}): `);
    if (!SUPPORTED_PROVIDERS.includes(input as SupportedProvider)) {
      console.error(`Unknown provider: ${input}`);
      rl.close();
      process.exit(1);
    }
    providerId = input as SupportedProvider;
  }

  const oauthProvider = providers[providerId];
  if (!oauthProvider) {
    console.error(`OAuth not configured for provider: ${providerId}`);
    rl.close();
    process.exit(1);
  }

  const store = createTokenStore();

  if (oauthProvider.deviceFlow) {
    await loginWithDeviceFlow(rl, oauthProvider, store);
  } else {
    await loginWithPKCE(rl, oauthProvider, store);
  }

  rl.close();
}

async function loginWithDeviceFlow(
  rl: ReturnType<typeof createInterface>,
  provider: {
    id: string;
    name: string;
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientId: string;
  },
  store: ReturnType<typeof createTokenStore>,
): Promise<void> {
  const config = {
    provider,
    store,
  };

  const deviceFlow = new DeviceFlow(config);

  console.log(`\nAuthenticating with ${provider.name}...`);
  console.log('Requesting device code...');

  try {
    const deviceCode = await deviceFlow.start();

    console.log(`\nOpen this URL in your browser: ${deviceCode.verificationUri}`);
    console.log(`Enter this code: ${deviceCode.userCode}\n`);
    console.log('Waiting for authorization...');

    const token = await deviceFlow.poll();

    const expiresIn = Math.round((token.expiresAt - Date.now()) / 1000);
    console.log(`\nAuthentication successful!`);
    console.log(`Token stored securely. Expires in ${expiresIn}s.`);
  } catch (err: any) {
    console.error(`\nAuthentication failed: ${err.message}`);
    process.exit(1);
  }
}

async function loginWithPKCE(
  rl: ReturnType<typeof createInterface>,
  provider: {
    id: string;
    name: string;
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientId: string;
  },
  store: ReturnType<typeof createTokenStore>,
): Promise<void> {
  console.log(`\nOAuth with PKCE is not yet supported for ${provider.name}.`);
  console.log('Use a personal access token instead: llm-bridge init');
  process.exit(1);
}
