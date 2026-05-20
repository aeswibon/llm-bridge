import type { CopilotConfig } from './types.js';
import { createTokenStore } from '../../oauth/index.js';

const COPILOT_API_BASE = 'https://api.github.com';

export async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${COPILOT_API_BASE}/copilot_internal/v2/token`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getToken(config: CopilotConfig): Promise<string | null> {
  if (config.COPILOT_TOKEN) return config.COPILOT_TOKEN;

  const store = createTokenStore();
  const token = await store.get('copilot');
  if (token && Date.now() < token.expiresAt) {
    return token.accessToken;
  }

  return config.COPILOT_OAUTH_TOKEN ?? null;
}

export async function refreshOAuthToken(
  _refreshToken: string,
  _clientId: string,
  _clientSecret: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  return null;
}
