import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CopilotBridgeSession } from '../src/session.js';
import type { Message } from '@llm-bridge/core';

describe('CopilotBridgeSession', () => {
  let session: CopilotBridgeSession;

  beforeEach(() => {
    session = new CopilotBridgeSession('test_token', 'gpt-4o-copilot');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a session with token and model', () => {
    expect(session).toBeDefined();
  });

  it('disposes without error', async () => {
    await expect(session.dispose()).resolves.not.toThrow();
  });

  it('yields error chunk on API failure', async () => {
    const messages: Message[] = [{ role: 'user', content: 'hello' }];
    const chunks: any[] = [];

    for await (const chunk of session.send(messages)) {
      chunks.push(chunk);
    }

    // In test environment, fetch will fail — should yield error chunk
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].type).toBe('error');
  });
});
