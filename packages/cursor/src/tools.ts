import type { ToolDefinition } from '@ai-ide-bridge/core';

export interface CursorTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export function translateTools(tools: ToolDefinition[]): CursorTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters as Record<string, unknown>,
    },
  }));
}

export function translateToolResult(toolCallId: string, result: string): string {
  return `[tool result for ${toolCallId}]\n${result}`;
}
