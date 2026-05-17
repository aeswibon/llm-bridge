import { describe, it, expect } from 'vitest';
import { translateTools, translateToolResult } from '../src/tools.js';
import type { ToolDefinition } from '@ai-ide-bridge/core';

describe('translateTools', () => {
  it('translates OpenAI tool definitions to Cursor format', () => {
    const tools: ToolDefinition[] = [
      {
        type: 'function',
        function: {
          name: 'search',
          description: 'Search the web',
          parameters: { type: 'object', properties: { q: { type: 'string' } } },
        },
      },
    ];
    const result = translateTools(tools);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('function');
    expect(result[0].function.name).toBe('search');
    expect(result[0].function.description).toBe('Search the web');
  });

  it('handles multiple tools', () => {
    const tools: ToolDefinition[] = [
      { type: 'function', function: { name: 'a', description: 'A', parameters: {} } },
      { type: 'function', function: { name: 'b', description: 'B', parameters: {} } },
    ];
    const result = translateTools(tools);
    expect(result).toHaveLength(2);
    expect(result[0].function.name).toBe('a');
    expect(result[1].function.name).toBe('b');
  });
});

describe('translateToolResult', () => {
  it('formats tool result with ID', () => {
    const result = translateToolResult('tc-1', 'search results');
    expect(result).toContain('tc-1');
    expect(result).toContain('search results');
  });
});
