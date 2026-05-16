import type { StoredToken, TokenStore } from './types.js';

export function createTokenStore(): TokenStore {
  const store = new Map<string, StoredToken>();

  return {
    async get(provider: string): Promise<StoredToken | null> {
      return store.get(provider) ?? null;
    },
    async set(provider: string, token: StoredToken): Promise<void> {
      store.set(provider, token);
    },
    async remove(provider: string): Promise<void> {
      store.delete(provider);
    },
  };
}
