import { describe, it, expect } from 'vitest';
import { providers } from '../src/providers.js';

describe('providers', () => {
  it('exports copilot provider', () => {
    expect(providers.copilot).toBeDefined();
    expect(providers.copilot.id).toBe('copilot');
    expect(providers.copilot.deviceFlow).toBe(true);
  });

  it('exports cursor provider', () => {
    expect(providers.cursor).toBeDefined();
    expect(providers.cursor.id).toBe('cursor');
  });

  it('has valid OAuth URLs for all providers', () => {
    for (const [id, provider] of Object.entries(providers)) {
      expect(provider.authUrl).toMatch(/^https:\/\//);
      expect(provider.tokenUrl).toMatch(/^https:\/\//);
      expect(provider.clientId.length).toBeGreaterThan(0);
      expect(Array.isArray(provider.scopes)).toBe(true);
    }
  });
});
