import { describe, it, expect } from 'vitest';
import { formatStreamChunk, formatCompletion } from '../src/formatter.js';
import type { StreamChunk } from '../src/types.js';

describe('formatStreamChunk', () => {
  it('formats text delta as SSE', () => {
    const chunk: StreamChunk = { type: 'text', content: 'Hello' };
    const result = formatStreamChunk(chunk, 'composer-2', 'chatcmpl-test');
    expect(result).toContain('data:');
    expect(result).toContain('"content":"Hello"');
    expect(result).toContain('"model":"composer-2"');
  });

  it('formats tool call as SSE', () => {
    const chunk: StreamChunk = {
      type: 'tool_call',
      toolCall: { id: 'tc-1', name: 'search', arguments: '{"q":"test"}' },
    };
    const result = formatStreamChunk(chunk, 'composer-2', 'chatcmpl-test');
    expect(result).toContain('"tool_calls"');
    expect(result).toContain('"name":"search"');
  });

  it('formats done chunk with finish_reason', () => {
    const chunk: StreamChunk = { type: 'done', finishReason: 'stop' };
    const result = formatStreamChunk(chunk, 'composer-2', 'chatcmpl-test');
    expect(result).toContain('"finish_reason":"stop"');
  });
});

describe('formatCompletion', () => {
  it('formats non-streaming completion', () => {
    const result = formatCompletion('Hello world', 'composer-2', 'chatcmpl-test');
    expect(result.id).toBe('chatcmpl-test');
    expect(result.choices[0].message.content).toBe('Hello world');
    expect(result.choices[0].finish_reason).toBe('stop');
  });
});
