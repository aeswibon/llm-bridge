import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionStore } from "../src/session.js";
import type { BridgeSession } from "../src/types.js";

function mockSession(): BridgeSession {
  return {
    send: async function* () {},
    dispose: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SessionStore", () => {
  let store: SessionStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new SessionStore(1800);
  });

  it("stores and retrieves sessions", () => {
    const session = mockSession();
    store.set("test-id", session);
    expect(store.get("test-id")).toBe(session);
  });

  it("returns undefined for missing sessions", () => {
    expect(store.get("nonexistent")).toBeUndefined();
  });

  it("disposes expired sessions", async () => {
    const session = mockSession();
    store.set("test-id", session);
    vi.advanceTimersByTime(1801 * 1000);
    store.cleanup();
    expect(store.get("test-id")).toBeUndefined();
    expect(session.dispose).toHaveBeenCalled();
  });

  it("disposes all sessions", async () => {
    const s1 = mockSession();
    const s2 = mockSession();
    store.set("id1", s1);
    store.set("id2", s2);
    await store.disposeAll();
    expect(s1.dispose).toHaveBeenCalled();
    expect(s2.dispose).toHaveBeenCalled();
  });
});
