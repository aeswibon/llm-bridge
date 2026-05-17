import type { WindsurfConfig } from './types.js';

const WINDSURF_API_BASE = 'https://server.codeium.com';

export function getToken(config: WindsurfConfig): string | null {
  return config.WINDSURF_TOKEN ?? config.WINDSURF_OAUTH_TOKEN ?? null;
}

export async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${WINDSURF_API_BASE}/api/v1/validate_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
