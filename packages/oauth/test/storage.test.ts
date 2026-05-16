import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createFileStore } from '../src/storage-file.js';
import type { StoredToken } from '../src/types.js';

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
