import { describe, it, expect } from 'vitest';
import { parseSSE, SSEEvent } from '../../src/sse/parser.js';

function makeStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunks = encoder.encode(text);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(chunks);
      controller.close();
    },
  });
}

async function collectEvents(stream: ReadableStream<Uint8Array>): Promise<SSEEvent[]> {
  const events: SSEEvent[] = [];
  for await (const event of parseSSE(stream)) {
    events.push(event);
  }
  return events;
}

describe('SSEParser', () => {
  it('parses a single data event', async () => {
    const stream = makeStream('data: hello\n\n');
    const events = await collectEvents(stream);
    expect(events).toEqual([{ data: 'hello' }]);
  });

  it('parses multiple events', async () => {
    const stream = makeStream('data: first\n\ndata: second\n\n');
    const events = await collectEvents(stream);
    expect(events).toEqual([{ data: 'first' }, { data: 'second' }]);
  });

  it('parses multi-line data', async () => {
    const stream = makeStream('data: line1\ndata: line2\n\n');
    const events = await collectEvents(stream);
    expect(events).toEqual([{ data: 'line1\nline2' }]);
  });

  it('parses event type', async () => {
    const stream = makeStream('event: error\ndata: something failed\n\n');
    const events = await collectEvents(stream);
    expect(events).toEqual([{ event: 'error', data: 'something failed' }]);
  });

  it('parses event id', async () => {
    const stream = makeStream('id: 42\ndata: payload\n\n');
    const events = await collectEvents(stream);
    expect(events).toEqual([{ id: '42', data: 'payload' }]);
  });

  it('parses retry field', async () => {
    const stream = makeStream('retry: 5000\ndata: x\n\n');
    const events = await collectEvents(stream);
    expect(events).toEqual([{ retry: 5000, data: 'x' }]);
  });

  it('skips comment lines', async () => {
    const stream = makeStream(': this is a comment\ndata: real\n\n');
    const events = await collectEvents(stream);
    expect(events).toEqual([{ data: 'real' }]);
  });

  it('handles empty stream', async () => {
    const stream = makeStream('');
    const events = await collectEvents(stream);
    expect(events).toEqual([]);
  });

  it('handles stream with only comments', async () => {
    const stream = makeStream(': comment 1\n: comment 2\n');
    const events = await collectEvents(stream);
    expect(events).toEqual([]);
  });
});
