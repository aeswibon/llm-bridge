import type { StreamChunk } from '../types.js';
import { createTransport, TransportOptions } from './transport.js';
import { SSEEvent } from './parser.js';

export interface StreamOptions extends Omit<TransportOptions, 'signal'> {
  parseEvent(event: SSEEvent): StreamChunk | null;
  signal?: AbortSignal;
}

export async function* createStream(opts: StreamOptions): AsyncIterable<StreamChunk> {
  const { parseEvent, signal, ...transportOpts } = opts;
  const transport = createTransport({ ...transportOpts, signal });

  if (signal) {
    signal.addEventListener('abort', () => transport.abort());
  }

  for await (const event of transport.stream()) {
    const chunk = parseEvent(event);
    if (chunk) {
      yield chunk;
    }
  }
}
