import type { CopilotConfig } from './types.js';

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

  try {
    const { createTokenStore } = await import('@ai-ide-bridge/oauth');
    const store = createTokenStore();
    const token = await store.get('copilot');
    if (token && Date.now() < token.expiresAt) {
      return token.accessToken;
    }
  } catch {
    // OAuth package may not be available
  }

  return config.COPILOT_OAUTH_TOKEN ?? null;
}

export async function refreshOAuthToken(
  refreshToken: string,
  clientId: string,
  _clientSecret: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    });

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Record<string, unknown>;
    if (!data.access_token) return null;

    return {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) ?? refreshToken,
    };
  } catch {
    return null;
  }
}
