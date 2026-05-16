import type { OAuthConfig, StoredToken } from './types.js';

export class DeviceFlow {
  constructor(private config: OAuthConfig) {}

  async start(): Promise<{ deviceCode: string; userCode: string; verificationUri: string }> {
    throw new Error('Not implemented');
  }

  async poll(): Promise<StoredToken> {
    throw new Error('Not implemented');
  }
}
