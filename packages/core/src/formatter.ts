import type { StreamChunk } from './types.js';

export function formatStreamChunk(chunk: StreamChunk, model: string, completionId: string): string {
  const delta: Record<string, unknown> = {};
  let finishReason: string | null = null;

  if (chunk.type === 'text' && chunk.content) {
    delta.content = chunk.content;
  }

  if (chunk.type === 'tool_call' && chunk.toolCall) {
    delta.tool_calls = [
      {
        index: 0,
        id: chunk.toolCall.id,
        type: 'function',
        function: { name: chunk.toolCall.name, arguments: chunk.toolCall.arguments },
      },
    ];
  }

  if (chunk.finishReason) {
    finishReason = chunk.finishReason;
  }

  const payload = {
    id: completionId,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };

  return `data: ${JSON.stringify(payload)}\n\n`;
}

interface ToolCallResult {
  id: string;
  name: string;
  arguments: string;
}

export function formatCompletion(
  content: string,
  model: string,
  completionId: string,
  toolCalls?: ToolCallResult[],
  finishReason?: string,
): Record<string, unknown> {
  const message: Record<string, unknown> = { role: 'assistant', content };
  if (toolCalls && toolCalls.length > 0) {
    message.tool_calls = toolCalls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: tc.arguments },
    }));
  }
  return {
    id: completionId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason || 'stop',
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
