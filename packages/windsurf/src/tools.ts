import type { ToolDefinition } from '@llm-bridge/core';
import type { WindsurfTool } from './types.js';

export function translateTools(tools: ToolDefinition[]): WindsurfTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters as Record<string, unknown>,
    },
  }));
}
