import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFileStore } from '../src/storage-file.js';
import type { StoredToken } from '../src/types.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';

// We need to test createFileStore with a custom path
// Since the file path is hardcoded in storage-file.ts, we'll test via the public API
// and clean up after each test

describe('createFileStore', () => {
  let store: ReturnType<typeof createFileStore>;
  const testToken: StoredToken = {
    version: 1,
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: Date.now() + 3600000,
    scopes: ['read:user'],
  };

  beforeEach(() => {
    store = createFileStore();
  });

  afterEach(async () => {
    await store.delete('test-provider');
    await store.delete('copilot');
    await store.delete('cursor');
  });

  it('stores and retrieves a token', async () => {
    await store.set('test-provider', testToken);
    const retrieved = await store.get('test-provider');
    expect(retrieved).toEqual(testToken);
  });

  it('returns null for missing provider', async () => {
    const retrieved = await store.get('nonexistent');
    expect(retrieved).toBeNull();
  });

  it('deletes a token', async () => {
    await store.set('test-provider', testToken);
    await store.delete('test-provider');
    const retrieved = await store.get('test-provider');
    expect(retrieved).toBeNull();
  });

  it('stores multiple providers independently', async () => {
    const copilotToken: StoredToken = { ...testToken, accessToken: 'copilot-token' };
    const cursorToken: StoredToken = { ...testToken, accessToken: 'cursor-token' };

    await store.set('copilot', copilotToken);
    await store.set('cursor', cursorToken);

    expect(await store.get('copilot')).toEqual(copilotToken);
    expect(await store.get('cursor')).toEqual(cursorToken);

    await store.delete('copilot');
    await store.delete('cursor');
  });
});

describe('createTokenStore', () => {
  it('returns a TokenStore', async () => {
    const { createTokenStore } = await import('../src/storage.js');
    const store = createTokenStore();
    expect(store).toBeDefined();
    expect(typeof store.set).toBe('function');
    expect(typeof store.get).toBe('function');
    expect(typeof store.delete).toBe('function');
  });
});
