import type { BridgeSession } from './types.js';

interface SessionEntry {
  session: BridgeSession;
  lastActive: number;
}

export class SessionStore {
  private sessions: Map<string, SessionEntry> = new Map();
  private ttlMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(ttlSeconds: number = 1800) {
    this.ttlMs = ttlSeconds * 1000;
  }

  startCleanup(intervalMs: number = 60000): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, intervalMs);
    this.cleanupInterval.unref();
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  set(id: string, session: BridgeSession): void {
    this.sessions.set(id, { session, lastActive: Date.now() });
  }

  get(id: string): BridgeSession | undefined {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.lastActive = Date.now();
      return entry.session;
    }
    return undefined;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, entry] of this.sessions.entries()) {
      if (now - entry.lastActive > this.ttlMs) {
        this.sessions.delete(id);
        entry.session.dispose().catch((err) => {
          console.error(`[session] dispose error for ${id}:`, err);
        });
      }
    }
  }

  async disposeAll(): Promise<void> {
    const disposals = Array.from(this.sessions.values()).map((entry) =>
      entry.session.dispose().catch((err) => {
        console.error('[session] disposeAll error:', err);
      }),
    );
    this.sessions.clear();
    await Promise.all(disposals);
  }

  get size(): number {
    return this.sessions.size;
  }
}
