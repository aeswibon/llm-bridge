import type { StoredToken, RefreshQueueEntry } from './types.js';

export class RefreshQueue {
  private pending = new Map<string, RefreshQueueEntry>();

  enqueue(provider: string, refreshFn: () => Promise<StoredToken>): Promise<StoredToken> {
    const existing = this.pending.get(provider);
    if (existing) return existing.promise;

    let resolve: (token: StoredToken) => void;
    let reject: (error: Error) => void;

    const promise = new Promise<StoredToken>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const entry: RefreshQueueEntry = { promise, resolve: resolve!, reject: reject! };
    this.pending.set(provider, entry);

    refreshFn()
      .then((token) => {
        this.pending.delete(provider);
        entry.resolve(token);
      })
      .catch((error) => {
        this.pending.delete(provider);
        entry.reject(error);
      });

    return promise;
  }
}
