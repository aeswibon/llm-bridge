import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CursorBridgeSession } from '../src/session.js';
import type { StreamChunk } from '@ai-ide-bridge/core';

describe('CursorBridgeSession', () => {
  let session: CursorBridgeSession;

  beforeEach(() => {
    session = new CursorBridgeSession('test-key', 'composer-2');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('yields text chunks from SSE stream', async () => {
    const sseText = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"finish_reason":"stop"}]}\n\n';
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseText));
        controller.close();
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      body: mockStream,
    } as unknown as Response);

    const chunks: StreamChunk[] = [];
    for await (const chunk of session.send([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks.some((c) => c.type === 'text' && c.content === 'Hello')).toBe(true);
    expect(chunks.some((c) => c.type === 'done')).toBe(true);
  });

  it('yields error chunk on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    } as unknown as Response);

    const chunks: StreamChunk[] = [];
    for await (const chunk of session.send([{ role: 'user', content: 'hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks.some((c) => c.type === 'error')).toBe(true);
  });

  it('disposes without error', async () => {
    await expect(session.dispose()).resolves.toBeUndefined();
  });
});
