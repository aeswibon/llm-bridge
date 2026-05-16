export interface OAuthProvider {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  deviceFlow?: boolean;
}

export interface StoredToken {
  version: 1;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scopes: string[];
}

export interface TokenStore {
  set(provider: string, token: StoredToken): Promise<void>;
  get(provider: string): Promise<StoredToken | null>;
  delete(provider: string): Promise<void>;
}

export interface OAuthConfig {
  provider: OAuthProvider;
  store: TokenStore;
  onRefresh?: (newToken: StoredToken) => Promise<void>;
}
