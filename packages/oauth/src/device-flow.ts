import type { OAuthConfig, StoredToken } from './types.js';

export class DeviceFlow {
  private deviceCode = '';
  private interval = 5000;
  private expiresAt = 0;

  constructor(private config: OAuthConfig) {}

  async start(): Promise<{ deviceCode: string; userCode: string; verificationUri: string }> {
    const params = new URLSearchParams({
      client_id: this.config.provider.clientId,
      scope: this.config.provider.scopes.join(' '),
    });

    const response = await fetch(this.config.provider.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: params.toString(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Device code request failed: ${response.status} ${body}`);
    }

    const data = await response.json() as Record<string, unknown>;

    this.deviceCode = data.device_code as string;
    this.interval = (data.interval as number ?? 5) * 1000;
    this.expiresAt = Date.now() + (data.expires_in as number) * 1000;

    return {
      deviceCode: this.deviceCode,
      userCode: data.user_code as string,
      verificationUri: data.verification_uri as string,
    };
  }

  async poll(): Promise<StoredToken> {
    if (!this.deviceCode) {
      throw new Error('No device code. Call start() first.');
    }

    while (Date.now() < this.expiresAt) {
      await this.sleep(this.interval);

      const params = new URLSearchParams({
        client_id: this.config.provider.clientId,
        device_code: this.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });

      const response = await fetch(this.config.provider.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: params.toString(),
      });

      const data = await response.json() as Record<string, unknown>;

      if (response.ok) {
        const token: StoredToken = {
          version: 1,
          accessToken: data.access_token as string,
          refreshToken: data.refresh_token as string | undefined,
          expiresAt: Date.now() + ((data.expires_in as number) ?? 3600) * 1000,
          scopes: (data.scope as string)?.split(' ') ?? this.config.provider.scopes,
        };

        await this.config.store.set(this.config.provider.id, token);
        return token;
      }

      const error = data.error as string;
      if (error === 'slow_down') {
        this.interval += 5000;
      } else if (error !== 'authorization_pending') {
        throw new Error(`Device flow error: ${error}`);
      }
    }

    throw new Error('Device flow expired');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
