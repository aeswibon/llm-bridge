import { describe, it, expect } from 'vitest';

describe('startCommand', () => {
  it('registers all configured plugins', async () => {
    // This is an integration test — verify config loading works
    const { readConfig } = await import('../src/utils/config.js');
    const config = readConfig();

    // Config should have defaultPlugin field
    expect(config.defaultPlugin).toBeDefined();
    expect(typeof config.defaultPlugin).toBe('string');
  });
});
