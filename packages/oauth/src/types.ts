export interface OAuthProvider {
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  scopes: string[];
}

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
}

export interface TokenStore {
  get(provider: string): Promise<StoredToken | null>;
  set(provider: string, token: StoredToken): Promise<void>;
  remove(provider: string): Promise<void>;
}

export interface OAuthConfig {
  provider: string;
  clientId: string;
  clientSecret?: string;
  scopes: string[];
  redirectUri?: string;
}
