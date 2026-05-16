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

export function getToken(config: CopilotConfig): string | null {
  return config.COPILOT_TOKEN ?? config.COPILOT_OAUTH_TOKEN ?? null;
}

// OAuth placeholder — wired up when OAuth Phase 2 is implemented
export async function refreshOAuthToken(
  _refreshToken: string,
  _clientId: string,
  _clientSecret: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  // TODO: Implement GitHub OAuth with PKCE flow
  return null;
}
