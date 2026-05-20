import type { OAuthProvider } from './types.js';

export const providers: Record<string, OAuthProvider> = {
  copilot: {
    id: 'copilot',
    name: 'GitHub Copilot',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['read:user', 'copilot'],
    clientId: 'Iv1.2a8e2d1e0e8b4f3a',
    deviceFlow: true,
  },
  cursor: {
    id: 'cursor',
    name: 'Cursor',
    authUrl: 'https://authenticator.cursor.sh/oauth/authorize',
    tokenUrl: 'https://authenticator.cursor.sh/oauth/token',
    scopes: ['openid', 'profile', 'email'],
    clientId: 'cursor-oauth-client',
  },
};
