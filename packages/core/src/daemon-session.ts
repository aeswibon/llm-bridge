import type { ChildProcess } from 'node:child_process';
import type { BridgeSession, Message, ToolDefinition, StreamChunk } from './types.js';
import type { DaemonManager } from './daemon.js';

export class DaemonBridgeSession implements BridgeSession {
  private proc: ChildProcess | null = null;
  private requestId = 0;

  constructor(
    private daemon: DaemonManager,
    private token: string,
    private model: string,
    private cwd: string,
  ) {}

  async *send(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk> {
    if (!this.proc) {
      const binaryPath = await this.daemon.locate();
      if (!binaryPath) {
        throw new Error(`Daemon binary '${this.daemon.binaryName}' not found`);
      }
      this.proc = this.daemon.spawn(binaryPath, []);
    }

    const id = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'chat/completions',
      params: {
        token: this.token,
        model: this.model,
        messages,
        stream: true,
        tools: tools?.map((t) => ({
          type: 'function' as const,
          function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          },
        })),
      },
    };

    this.proc.stdin!.write(JSON.stringify(request) + '\n');

    let buffer = '';
    let finished = false;
    let capturedError: Error | null = null;

    const onData = (data: Buffer) => {
      buffer += data.toString();
    };

    const onError = (err: Error) => {
      if (!capturedError) {
        capturedError = err;
        this.proc?.removeAllListeners();
        this.proc = null;
      }
    };

    this.proc.stdout!.on('data', onData);
    this.proc.on('error', onError);

    try {
      while (!finished) {
        if (capturedError) {
          yield {
            type: 'error',
            content: `Process error: ${(capturedError as Error).message}`,
            finishReason: 'error',
          };
          finished = true;
          break;
        }

        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          continue;
        }

        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (!line.trim()) continue;

        let parsed: any;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }

        if (parsed.error) {
          yield {
            type: 'error',
            content: `JSON-RPC error: ${parsed.error.message}`,
            finishReason: 'error',
          };
          finished = true;
          continue;
        }

        if (parsed.method === 'chat/chunk' && parsed.params) {
          const delta = parsed.params.delta;
          if (delta?.content) {
            yield { type: 'text', content: delta.content };
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              yield {
                type: 'tool_call',
                toolCall: {
                  id: tc.id ?? '',
                  name: tc.name ?? '',
                  arguments: tc.arguments ?? '',
                },
              };
            }
          }
        }

        if (parsed.method === 'chat/done' && parsed.params) {
          const reason = parsed.params.finishReason;
          yield {
            type: 'done',
            finishReason:
              reason === 'stop' ? 'stop' : reason === 'tool_calls' ? 'tool_calls' : reason === 'length' ? 'length' : 'error',
          };
          finished = true;
        }

        if (parsed.id === id && parsed.result) {
          finished = true;
        }
      }
    } finally {
      this.proc?.stdout?.removeListener('data', onData);
      this.proc?.removeListener('error', onError);
    }
  }

  async dispose(): Promise<void> {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }
}
