import type { BridgeSession, Message, ToolDefinition, StreamChunk } from '../../core/index.js';
import { translateTools } from './tools.js';

const COPILOT_API_BASE = 'https://api.github.com';

export class CopilotBridgeSession implements BridgeSession {
  private token: string;
  private modelId: string;

  constructor(token: string, modelId: string) {
    this.token = token;
    this.modelId = modelId;
  }

  async *send(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk> {
    const body = {
      model: this.modelId,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content ?? '',
        ...(m.tool_calls && { tool_calls: m.tool_calls }),
        ...(m.tool_call_id && { tool_call_id: m.tool_call_id }),
      })),
      ...(tools && { tools: translateTools(tools) }),
      stream: true,
    };

    try {
      const response = await fetch(`${COPILOT_API_BASE}/copilot_internal/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        yield {
          type: 'error',
          content: `Copilot API error: ${response.status} ${errorText}`,
          finishReason: 'error',
        };
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        yield { type: 'error', content: 'No response body', finishReason: 'error' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let finished = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            if (!finished) {
              yield { type: 'done', finishReason: 'stop' };
            }
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;

            if (delta?.content) {
              yield { type: 'text', content: delta.content };
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                yield {
                  type: 'tool_call',
                  toolCall: {
                    id: tc.id ?? '',
                    name: tc.function?.name ?? '',
                    arguments: tc.function?.arguments ?? '',
                  },
                };
              }
            }

            if (parsed.choices?.[0]?.finish_reason && !finished) {
              const reason = parsed.choices[0].finish_reason;
              const finishReason =
                reason === 'stop'
                  ? 'stop'
                  : reason === 'tool_calls'
                    ? 'tool_calls'
                    : reason === 'length'
                      ? 'length'
                      : 'error';
              yield {
                type: 'done',
                finishReason,
              };
              finished = true;
            }
          } catch {
            // Skip malformed SSE data
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      yield { type: 'error', content: msg, finishReason: 'error' };
    }
  }

  async dispose(): Promise<void> {
    // No persistent connections to dispose
  }
}
