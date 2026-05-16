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

export function formatCompletion(
  content: string,
  model: string,
  completionId: string,
): Record<string, unknown> {
  return {
    id: completionId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
