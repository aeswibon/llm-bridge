import type { StoredToken, TokenStore } from './types.js';

export class TokenLifecycle {
  constructor(private store: TokenStore) {}

  async refresh(provider: string): Promise<StoredToken> {
    throw new Error('Not implemented');
  }

  async isValid(provider: string): Promise<boolean> {
    throw new Error('Not implemented');
  }
}
