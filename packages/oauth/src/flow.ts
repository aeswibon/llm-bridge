import { randomBytes, createHash } from 'node:crypto';
import type { OAuthConfig, StoredToken, TokenStore, PKCEState } from './types.js';

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

    const redirectUri = (this.config.provider as unknown as Record<string, unknown>).redirectUri as string | undefined;
    if (redirectUri) {
      params.set('redirect_uri', redirectUri);
    }

    return `${this.config.provider.authUrl}?${params.toString()}`;
  }

  async callback(code: string): Promise<StoredToken> {
    if (!this.pkceState) {
      throw new Error('No pending PKCE state');
    }

    const { codeVerifier } = this.pkceState;
    this.pkceState = null;

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: (this.config.provider as unknown as Record<string, unknown>).redirectUri as string ?? 'http://localhost',
      code_verifier: codeVerifier,
      client_id: this.config.provider.clientId,
    });

    const response = await fetch(this.config.provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${body}`);
    }

    const data = await response.json() as StoredToken;
    if (!data.expiresAt) {
      data.expiresAt = Date.now() + 3600000;
    }
    data.version = 1;

    await this.store.set(this.config.provider.id, data);
    return data;
  }

  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(verifier: string): string {
    return createHash('sha256').update(verifier).digest('base64url');
  }
}
