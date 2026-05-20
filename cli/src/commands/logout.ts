import { createTokenStore } from '../oauth/index.js';

export async function logoutCommand(provider?: string): Promise<void> {
  const store = createTokenStore();

  if (provider) {
    await store.delete(provider);
    console.log(`Logged out from ${provider}.`);
    return;
  }

  await store.delete('copilot');
  await store.delete('cursor');
  console.log('Logged out from all providers.');
}
