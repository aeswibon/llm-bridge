import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefreshQueue } from '../src/queue.js';
import type { StoredToken } from '../src/types.js';

describe('RefreshQueue', () => {
  let queue: RefreshQueue;

  beforeEach(() => {
    queue = new RefreshQueue();
  });

  it('deduplicates concurrent refresh requests for same provider', async () => {
    const refreshFn = vi.fn().mockResolvedValue({
      version: 1,
      accessToken: 'token-1',
      expiresAt: Date.now() + 3600000,
      scopes: [],
    } as StoredToken);

    const [result1, result2, result3] = await Promise.all([
      queue.enqueue('provider-a', refreshFn),
      queue.enqueue('provider-a', refreshFn),
      queue.enqueue('provider-a', refreshFn),
    ]);

    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('allows concurrent requests for different providers', async () => {
    const refreshA = vi.fn().mockResolvedValue({
      version: 1, accessToken: 'token-a', expiresAt: Date.now() + 3600000, scopes: [],
    } as StoredToken);
    const refreshB = vi.fn().mockResolvedValue({
      version: 1, accessToken: 'token-b', expiresAt: Date.now() + 3600000, scopes: [],
    } as StoredToken);

    const [resultA, resultB] = await Promise.all([
      queue.enqueue('provider-a', refreshA),
      queue.enqueue('provider-b', refreshB),
    ]);

    expect(refreshA).toHaveBeenCalledTimes(1);
    expect(refreshB).toHaveBeenCalledTimes(1);
    expect(resultA.accessToken).toBe('token-a');
    expect(resultB.accessToken).toBe('token-b');
  });

  it('propagates errors to all waiting callers', async () => {
    const refreshFn = vi.fn().mockRejectedValue(new Error('Network error'));

    const [err1, err2] = await Promise.all([
      queue.enqueue('provider-x', refreshFn).catch((e) => e),
      queue.enqueue('provider-x', refreshFn).catch((e) => e),
    ]);

    expect(err1).toBeInstanceOf(Error);
    expect((err1 as Error).message).toBe('Network error');
    expect(err2).toBeInstanceOf(Error);
    expect((err2 as Error).message).toBe('Network error');
    expect(refreshFn).toHaveBeenCalledTimes(1);
  });

  it('clears queue entry after completion', async () => {
    const refreshFn = vi.fn().mockResolvedValue({
      version: 1, accessToken: 'token', expiresAt: Date.now() + 3600000, scopes: [],
    } as StoredToken);

    await queue.enqueue('provider', refreshFn);
    await queue.enqueue('provider', refreshFn);

    expect(refreshFn).toHaveBeenCalledTimes(2);
  });
});
