import type { BridgeSession, Message, ToolDefinition, StreamChunk, SSEEvent } from '../../core/index.js';
import { createStream } from '../../core/index.js';

const CURSOR_API_BASE = 'https://api2.cursor.sh';

export class CursorBridgeSession implements BridgeSession {
  private apiKey: string;
  private modelId: string;

  constructor(apiKey: string, modelId: string) {
    this.apiKey = apiKey;
    this.modelId = modelId;
  }

  async *send(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk> {
    const body = JSON.stringify({
      model: this.modelId,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls && { tool_calls: m.tool_calls }),
        ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
        ...(m.name && { name: m.name }),
      })),
      ...(tools && { tools: tools.map((t) => t) }),
      stream: true,
    });

    for await (const chunk of createStream({
      url: `${CURSOR_API_BASE}/aiserver.v1.AiService/StreamChat`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'text/event-stream',
      },
      body,
      parseEvent: parseCursorEvent,
    })) {
      yield chunk;
    }
  }

  async dispose(): Promise<void> {
    // No state to dispose with direct HTTP
  }
}

function parseCursorEvent(event: SSEEvent): StreamChunk | null {
  if (event.event === 'error') {
    return { type: 'error', content: event.data, finishReason: 'error' };
  }

  if (event.data === '' || event.data === '[DONE]') {
    return { type: 'done', finishReason: 'stop' };
  }

  try {
    const json = JSON.parse(event.data);

    if (json.error) {
      return { type: 'error', content: json.error.message ?? JSON.stringify(json.error), finishReason: 'error' };
    }

    if (json.choices?.[0]?.delta?.content) {
      return { type: 'text', content: json.choices[0].delta.content };
    }

    if (json.choices?.[0]?.delta?.tool_calls) {
      for (const tc of json.choices[0].delta.tool_calls) {
        return {
          type: 'tool_call',
          toolCall: {
            id: tc.id ?? `tc-${Date.now()}`,
            name: tc.function?.name ?? '',
            arguments: tc.function?.arguments ?? '',
          },
        };
      }
    }

    if (json.choices?.[0]?.finish_reason) {
      return { type: 'done', finishReason: json.choices[0].finish_reason === 'stop' ? 'stop' : 'tool_calls' };
    }
  } catch {
    return null;
  }

  return null;
}
