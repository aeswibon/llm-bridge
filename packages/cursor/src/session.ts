import { Agent } from '@cursor/sdk';
import type { SDKAgent, SendOptions } from '@cursor/sdk';
import type { BridgeSession, Message, ToolDefinition, StreamChunk } from '@ai-ide-bridge/core';
import { translateTools } from './tools.js';

export class CursorBridgeSession implements BridgeSession {
  private agent: SDKAgent | null = null;
  private apiKey: string;
  private modelId: string;
  private cwd: string;

  constructor(apiKey: string, modelId: string, cwd: string = process.cwd()) {
    this.apiKey = apiKey;
    this.modelId = modelId;
    this.cwd = cwd;
  }

  async *send(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk> {
    const prompt = this.buildPrompt(messages);
    const cursorTools = tools ? translateTools(tools) : undefined;

    try {
      this.agent = await Agent.create({
        apiKey: this.apiKey,
        model: { id: this.modelId },
        local: { cwd: this.cwd, settingSources: [] },
      });

      const sendOptions: SendOptions = {
        model: { id: this.modelId },
        onDelta: ({ update }) => {
          if (update.type === 'text-delta' && 'text' in update && update.text) {
            // onDelta is synchronous callback, we buffer and yield in the loop
          }
        },
      };

      const run = await this.agent.send(prompt, sendOptions);

      const result = await run.wait();
      if (result.status === 'error' || result.status === 'cancelled') {
        yield {
          type: 'error',
          content: `Agent run ${result.status}: ${result.result ?? 'no details'}`,
          finishReason: 'error',
        };
        return;
      }

      yield { type: 'text', content: result.result ?? '', finishReason: 'stop' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      yield { type: 'error', content: msg, finishReason: 'error' };
    }
  }

  async dispose(): Promise<void> {
    if (this.agent) {
      try {
        await this.agent[Symbol.asyncDispose]();
      } catch {
        // Ignore dispose errors
      }
      this.agent = null;
    }
  }

  private buildPrompt(messages: Message[]): string {
    const blocks: string[] = [];
    for (const m of messages) {
      const text =
        typeof m.content === 'string'
          ? m.content
          : m.content != null
            ? JSON.stringify(m.content)
            : '';
      if (!text) continue;
      const label = m.role === 'tool' ? `tool (${m.tool_call_id ?? m.name ?? 'result'})` : m.role;
      blocks.push(`[${label}]\n${text}`);
    }
    return `\nFollow this conversation transcript and reply as the assistant.\n\n${blocks.join('\n\n---\n\n')}\n`;
  }
}
