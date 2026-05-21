import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStream, StreamOptions } from '../../src/sse/client.js';
import { SSEEvent } from '../../src/sse/parser.js';
import type { StreamChunk } from '../../src/types.js';

describe('StreamingClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('maps SSE events to StreamChunk via parseEvent', async () => {
    const sseText = 'data: {"delta":"hello"}\n\ndata: {"delta":"world"}\n\n';
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseText));
        controller.close();
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      }),
    );

    const parseEvent = (event: SSEEvent): StreamChunk | null => {
      try {
        const json = JSON.parse(event.data);
        if (json.delta) return { type: 'text', content: json.delta };
      } catch {
        return null;
      }
      return null;
    };

    const chunks: StreamChunk[] = [];
    for await (const chunk of createStream({ url: 'http://test/api', parseEvent })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { type: 'text', content: 'hello' },
      { type: 'text', content: 'world' },
    ]);
  });

  it('yields error chunk when parseEvent returns error', async () => {
    const sseText = 'event: error\ndata: something broke\n\n';
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseText));
        controller.close();
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: mockStream,
      }),
    );

    const parseEvent = (event: SSEEvent): StreamChunk | null => {
      if (event.event === 'error')
        return { type: 'error', content: event.data, finishReason: 'error' };
      return null;
    };

    const chunks: StreamChunk[] = [];
    for await (const chunk of createStream({ url: 'http://test/api', parseEvent })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([{ type: 'error', content: 'something broke', finishReason: 'error' }]);
  });

  it('aborts cleanly via signal', async () => {
    vi.useRealTimers();

    const controller = new AbortController();
    const parseEvent = (): StreamChunk | null => null;

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        });
      }),
    );

    setTimeout(() => controller.abort(), 10);

    const chunks: StreamChunk[] = [];
    for await (const chunk of createStream({
      url: 'http://test/api',
      parseEvent,
      signal: controller.signal,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([]);
  });

  it('handles HTTP 4xx without retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      }),
    );

    const parseEvent = (event: SSEEvent): StreamChunk | null => {
      if (event.event === 'error')
        return { type: 'error', content: event.data, finishReason: 'error' };
      return null;
    };

    const chunks: StreamChunk[] = [];
    for await (const chunk of createStream({ url: 'http://test/api', parseEvent, maxRetries: 3 })) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('error');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
