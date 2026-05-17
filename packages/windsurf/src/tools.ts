import type { ToolDefinition } from '@ai-ide-bridge/core';
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
