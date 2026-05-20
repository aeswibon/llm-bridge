import type { OAuthConfig, StoredToken, TokenStore } from './types.js';

export interface TokenLifecycleOptions {
  gracePeriodMs?: number;
  config?: OAuthConfig;
}

export class TokenLifecycle {
  private gracePeriodMs: number;
  private config?: OAuthConfig;

  constructor(
    private store: TokenStore,
    options: TokenLifecycleOptions = {},
  ) {
    this.gracePeriodMs = options.gracePeriodMs ?? 0;
    this.config = options.config;
  }

  async isValid(provider: string): Promise<boolean> {
    const token = await this.store.get(provider);
    if (!token) return false;

    const expiresAt = token.expiresAt - this.gracePeriodMs;
    return Date.now() < expiresAt;
  }

  async refresh(provider: string): Promise<StoredToken> {
    const token = await this.store.get(provider);
    if (!token?.refreshToken) {
      throw new Error('No refresh token available');
    }

    if (!this.config) {
      throw new Error('OAuthConfig required for token refresh');
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
      client_id: this.config.provider.clientId,
    });

    const response = await fetch(this.config.provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    if (!data.access_token) {
      throw new Error('Invalid token response: missing access_token');
    }

    const newToken: StoredToken = {
      version: 1,
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) ?? token.refreshToken,
      expiresAt: Date.now() + ((data.expires_in as number) ?? 3600) * 1000,
      scopes: token.scopes,
    };

    await this.store.set(provider, newToken);

    if (this.config.onRefresh) {
      await this.config.onRefresh(newToken);
    }

    return newToken;
  }
}
