import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CopilotBridgeSession } from '../src/session.js';
import type { Message } from '@ai-ide-bridge/core';

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

  it('yields error chunk on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    } as Response);

    const messages: Message[] = [{ role: 'user', content: 'hello' }];
    const chunks: any[] = [];

    for await (const chunk of session.send(messages)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('error');
    expect(chunks[0].content).toContain('401');
  });

  it('yields text and done chunks on success', async () => {
    const encoder = new TextEncoder();
    const sseData = [
      'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      'data: [DONE]',
    ].join('\n');

    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: encoder.encode(sseData) })
        .mockResolvedValueOnce({ done: true, value: undefined }),
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response);

    const messages: Message[] = [{ role: 'user', content: 'hello' }];
    const chunks: any[] = [];

    for await (const chunk of session.send(messages)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ type: 'text', content: 'Hello' });
    expect(chunks[1]).toEqual({ type: 'done', finishReason: 'stop' });
  });

  it('yields error chunk on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const messages: Message[] = [{ role: 'user', content: 'hello' }];
    const chunks: any[] = [];

    for await (const chunk of session.send(messages)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('error');
    expect(chunks[0].content).toBe('Network error');
  });
});
