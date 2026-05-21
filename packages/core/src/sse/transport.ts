import { parseSSE, SSEEvent } from './parser.js';

export interface TransportOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface Transport {
  stream(): AsyncIterable<SSEEvent>;
  abort(): void;
}

export function createTransport(opts: TransportOptions): Transport {
  const {
    url,
    method = 'POST',
    headers = {},
    body,
    signal,
    timeout = 30000,
    maxRetries = 3,
    retryDelay = 1000,
  } = opts;

  let aborted = false;

  return {
    stream(): AsyncIterable<SSEEvent> {
      return streamWithRetry();
    },
    abort(): void {
      aborted = true;
    },
  };

  async function* streamWithRetry(): AsyncIterable<SSEEvent> {
    let lastEventId: string | undefined;
    let retries = 0;

    while (!aborted && retries <= maxRetries) {
      const requestHeaders: Record<string, string> = { ...headers };
      if (lastEventId) {
        requestHeaders['Last-Event-ID'] = lastEventId;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        if (signal) {
          signal.addEventListener('abort', () => controller.abort());
        }

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) {
            const errorText = await response.text().catch(() => '');
            yield { event: 'error', data: `HTTP ${response.status}: ${errorText}` };
            return;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        if (!response.body) {
          yield { event: 'error', data: 'No response body' };
          return;
        }

        retries = 0;

        for await (const event of parseSSE(response.body)) {
          if (event.id) lastEventId = event.id;
          yield event;
        }

        return;
      } catch (e) {
        if (aborted) return;

        const isAbort = e instanceof DOMException && e.name === 'AbortError';
        if (isAbort && retries >= maxRetries) {
          yield { event: 'error', data: 'Request timed out' };
          return;
        }

        retries++;
        if (retries > maxRetries) {
          yield { event: 'error', data: e instanceof Error ? e.message : String(e) };
          return;
        }

        const delay = retryDelay * Math.pow(2, retries - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
