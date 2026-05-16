import type { OAuthConfig, StoredToken, TokenStore } from './types.js';

export class OAuthFlow {
  constructor(
    private config: OAuthConfig,
    private store: TokenStore,
  ) {}

  async start(): Promise<string> {
    throw new Error('Not implemented');
  }

  async callback(code: string): Promise<StoredToken> {
    throw new Error('Not implemented');
  }
}
