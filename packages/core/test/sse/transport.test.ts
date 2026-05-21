import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTransport, TransportOptions } from '../../src/sse/transport.js';

function makeSSEText(events: string[]): string {
  return events.map((e) => `data: ${e}\n\n`).join('');
}

describe('SSETransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('streams events from successful fetch', async () => {
    const sseText = makeSSEText(['hello', 'world']);
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sseText));
        controller.close();
      },
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream,
    }));

    const transport = createTransport({ url: 'http://test/api' });
    const events: string[] = [];
    for await (const event of transport.stream()) {
      if (event.data) events.push(event.data);
    }

    expect(events).toEqual(['hello', 'world']);
    expect(fetch).toHaveBeenCalledWith('http://test/api', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('does not retry on 4xx errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }));

    const transport = createTransport({ url: 'http://test/api', maxRetries: 3 });
    const events: string[] = [];
    for await (const event of transport.stream()) {
      if (event.data) events.push(event.data);
    }

    expect(events).toContain('HTTP 401: Unauthorized');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx errors', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('data: ok\n\n'));
            controller.close();
          },
        }),
      })
    );

    const transport = createTransport({ url: 'http://test/api', maxRetries: 3, retryDelay: 100 });
    const iter = transport.stream()[Symbol.asyncIterator]();

    const resultPromise = (async () => {
      const events: string[] = [];
      while (true) {
        const next = await iter.next();
        if (next.done) break;
        if (next.value.data) events.push(next.value.data);
      }
      return events;
    })();

    await vi.advanceTimersByTimeAsync(2000);

    const events = await resultPromise;
    expect(events).toContain('ok');
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('aborts cleanly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url, opts) => {
      return new Promise((resolve, reject) => {
        if (opts?.signal) {
          opts.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      });
    }));

    const transport = createTransport({ url: 'http://test/api', timeout: 100 });

    const iter = transport.stream()[Symbol.asyncIterator]();
    const resultPromise = iter.next();

    await vi.advanceTimersByTimeAsync(10);
    transport.abort();
    await vi.advanceTimersByTimeAsync(200);

    const result = await resultPromise;
    expect(result.done).toBe(true);
    expect(result.value).toBeUndefined();
  });

  it('passes custom headers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) { controller.close(); },
      }),
    }));

    const transport = createTransport({
      url: 'http://test/api',
      headers: { Authorization: 'Bearer test123' },
    });

    for await (const _ of transport.stream()) {}

    expect(fetch).toHaveBeenCalledWith('http://test/api', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test123' }),
    }));
  });
});
