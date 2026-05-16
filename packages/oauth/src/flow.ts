import { randomBytes, createHash } from 'node:crypto';
import type { OAuthConfig, StoredToken, TokenStore, PKCEState } from './types.js';

const DEFAULT_TOKEN_EXPIRY_MS = 3600000;

export class OAuthFlow {
  private pkceState: PKCEState | null = null;

  constructor(
    private config: OAuthConfig,
    private store: TokenStore,
  ) {}

  async start(): Promise<string> {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = randomBytes(16).toString('hex');

    this.pkceState = { codeVerifier, codeChallenge, state };

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.provider.clientId,
      scope: this.config.provider.scopes.join(' '),
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state,
    });

    if (this.config.redirectUri) {
      params.set('redirect_uri', this.config.redirectUri);
    }

    return `${this.config.provider.authUrl}?${params.toString()}`;
  }

  async callback(code: string, state: string): Promise<StoredToken> {
    if (!this.pkceState) {
      throw new Error('No pending PKCE state');
    }

    if (state !== this.pkceState.state) {
      throw new Error('State mismatch');
    }

    const { codeVerifier } = this.pkceState;
    this.pkceState = null;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: this.config.provider.clientId,
    });

    if (this.config.redirectUri) {
      params.set('redirect_uri', this.config.redirectUri);
    }

    const response = await fetch(this.config.provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${body}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    const newToken: StoredToken = {
      version: 1,
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string | undefined,
      expiresAt: data.expires_in
        ? Date.now() + (data.expires_in as number) * 1000
        : DEFAULT_TOKEN_EXPIRY_MS,
      scopes: this.config.provider.scopes,
    };

    await this.store.set(this.config.provider.id, newToken);
    return newToken;
  }

  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }
}
