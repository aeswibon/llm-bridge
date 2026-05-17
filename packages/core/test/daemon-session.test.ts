import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DaemonBridgeSession } from '../src/daemon-session.js';
import type { DaemonManager } from '../src/daemon.js';
import type { Message, StreamChunk } from '../src/types.js';
import { EventEmitter } from 'node:events';

function createMockDaemon(): DaemonManager & { emitOutput(lines: string[]): void; lastProc: any } {
  const mockStdout = new EventEmitter() as NodeJS.ReadableStream;
  const mockStdin = new EventEmitter() as NodeJS.WritableStream;
  (mockStdin as any).write = vi.fn(() => true);

  const mockProc = new EventEmitter() as any;
  mockProc.stdin = mockStdin;
  mockProc.stdout = mockStdout;
  mockProc.stderr = new EventEmitter();
  mockProc.kill = vi.fn(() => true);
  mockProc.pid = 12345;

  const daemon: DaemonManager & { emitOutput(lines: string[]): void; lastProc: any } = {
    binaryName: 'mock-daemon',
    locate: async () => '/mock/path',
    download: async () => '/mock/path',
    spawn: (_binaryPath: string, _args: string[]) => {
      daemon.lastProc = mockProc;
      return mockProc;
    },
    healthCheck: async () => true,
    emitOutput(lines: string[]) {
      for (const line of lines) {
        mockStdout.emit('data', Buffer.from(line + '\n'));
      }
    },
    lastProc: null,
  };

  return daemon;
}

describe('DaemonBridgeSession', () => {
  let daemon: ReturnType<typeof createMockDaemon>;
  let session: DaemonBridgeSession;

  beforeEach(() => {
    daemon = createMockDaemon();
    session = new DaemonBridgeSession(daemon, 'test-token', 'test-model', '/test/cwd');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('send', () => {
    it('sends JSON-RPC request and yields text chunks', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hi' }];

      setTimeout(() => {
        daemon.emitOutput([
          JSON.stringify({ jsonrpc: '2.0', method: 'chat/chunk', params: { id: 1, delta: { content: 'Hello' } } }),
          JSON.stringify({ jsonrpc: '2.0', method: 'chat/chunk', params: { id: 1, delta: { content: ' world' } } }),
          JSON.stringify({ jsonrpc: '2.0', method: 'chat/done', params: { id: 1, finishReason: 'stop' } }),
        ]);
      }, 10);

      const chunks: StreamChunk[] = [];
      for await (const chunk of session.send(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ type: 'text', content: 'Hello' });
      expect(chunks[1]).toEqual({ type: 'text', content: ' world' });
      expect(chunks[2]).toEqual({ type: 'done', finishReason: 'stop' });
    });

    it('yields tool_call chunks from JSON-RPC response', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Search' }];

      setTimeout(() => {
        daemon.emitOutput([
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'chat/chunk',
            params: {
              id: 1,
              delta: {
                tool_calls: [{ id: 'tc1', name: 'search', arguments: '{"q":"test"}' }],
              },
            },
          }),
          JSON.stringify({ jsonrpc: '2.0', method: 'chat/done', params: { id: 1, finishReason: 'tool_calls' } }),
        ]);
      }, 10);

      const chunks: StreamChunk[] = [];
      for await (const chunk of session.send(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({
        type: 'tool_call',
        toolCall: { id: 'tc1', name: 'search', arguments: '{"q":"test"}' },
      });
      expect(chunks[1]).toEqual({ type: 'done', finishReason: 'tool_calls' });
    });

    it('yields error chunk on JSON-RPC error', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hi' }];

      setTimeout(() => {
        daemon.emitOutput([
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: { code: -32603, message: 'Internal error' },
          }),
        ]);
      }, 10);

      const chunks: StreamChunk[] = [];
      for await (const chunk of session.send(messages)) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('Internal error');
    });

    it('yields error chunk when daemon process fails', async () => {
      const failingStdin = new EventEmitter() as NodeJS.WritableStream;
      (failingStdin as any).write = vi.fn(() => true);

      const failingDaemon: DaemonManager = {
        binaryName: 'failing',
        locate: async () => '/mock/path',
        download: async () => '/mock/path',
        spawn: (_binaryPath: string, _args: string[]) => {
          const proc = new EventEmitter() as any;
          proc.stdin = failingStdin;
          proc.stdout = new EventEmitter();
          proc.stderr = new EventEmitter();
          proc.kill = vi.fn(() => true);
          proc.pid = 12345;
          setTimeout(() => {
            proc.emit('error', new Error('Daemon crashed'));
          }, 10);
          return proc;
        },
        healthCheck: async () => true,
      };

      const failingSession = new DaemonBridgeSession(failingDaemon, 'token', 'model', '/cwd');
      const chunks: StreamChunk[] = [];

      for await (const chunk of failingSession.send([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
    });

    it('yields error on concurrent send() calls', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hi' }];

      setTimeout(() => {
        daemon.emitOutput([
          JSON.stringify({ jsonrpc: '2.0', method: 'chat/done', params: { id: 1, finishReason: 'stop' } }),
        ]);
      }, 20);

      const firstGen = session.send(messages);
      const firstPromise = (async () => {
        for await (const _ of firstGen) {
          // consume
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 5));

      const secondGen = session.send(messages);
      const chunks: StreamChunk[] = [];
      for await (const chunk of secondGen) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('concurrent send()');

      await firstPromise;
    });

    it('captures stderr and includes it in error output', async () => {
      const mockStdout = new EventEmitter() as NodeJS.ReadableStream;
      const mockStdin = new EventEmitter() as NodeJS.WritableStream;
      (mockStdin as any).write = vi.fn(() => true);

      const mockStderr = new EventEmitter();
      const mockProc = new EventEmitter() as any;
      mockProc.stdin = mockStdin;
      mockProc.stdout = mockStdout;
      mockProc.stderr = mockStderr;
      mockProc.kill = vi.fn(() => true);
      mockProc.pid = 12345;

      const stderrDaemon: DaemonManager = {
        binaryName: 'stderr-test',
        locate: async () => '/mock/path',
        download: async () => '/mock/path',
        spawn: () => {
          setTimeout(() => {
            mockStderr.emit('data', Buffer.from('fatal: daemon crashed\n'));
            mockProc.emit('error', new Error('process error'));
          }, 10);
          return mockProc;
        },
        healthCheck: async () => true,
      };

      const stderrSession = new DaemonBridgeSession(stderrDaemon, 'token', 'model', '/cwd');
      const chunks: StreamChunk[] = [];

      for await (const chunk of stderrSession.send([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('stderr:');
      expect(chunks[0].content).toContain('daemon crashed');
    });

    it('yields error when stdout buffer exceeds max size', async () => {
      const mockStdout = new EventEmitter() as NodeJS.ReadableStream;
      const mockStdin = new EventEmitter() as NodeJS.WritableStream;
      (mockStdin as any).write = vi.fn(() => true);

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = mockStdin;
      mockProc.stdout = mockStdout;
      mockProc.stderr = new EventEmitter();
      mockProc.kill = vi.fn(() => true);
      mockProc.pid = 12345;

      const overflowDaemon: DaemonManager = {
        binaryName: 'overflow-test',
        locate: async () => '/mock/path',
        download: async () => '/mock/path',
        spawn: () => {
          setTimeout(() => {
            mockStdout.emit('data', Buffer.from('\n'));
            mockStdout.emit('data', Buffer.from('x'.repeat(1024 * 1024 + 1)));
          }, 10);
          return mockProc;
        },
        healthCheck: async () => true,
      };

      const overflowSession = new DaemonBridgeSession(overflowDaemon, 'token', 'model', '/cwd');
      const chunks: StreamChunk[] = [];

      for await (const chunk of overflowSession.send([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('exceeded max size');
    });

    it('yields error when process exits without emitting error event', async () => {
      const mockStdout = new EventEmitter() as NodeJS.ReadableStream;
      const mockStdin = new EventEmitter() as NodeJS.WritableStream;
      (mockStdin as any).write = vi.fn(() => true);

      const mockProc = new EventEmitter() as any;
      mockProc.stdin = mockStdin;
      mockProc.stdout = mockStdout;
      mockProc.stderr = new EventEmitter();
      mockProc.kill = vi.fn(() => true);
      mockProc.pid = 12345;

      const exitDaemon: DaemonManager = {
        binaryName: 'exit-test',
        locate: async () => '/mock/path',
        download: async () => '/mock/path',
        spawn: () => {
          setTimeout(() => {
            mockProc.emit('exit', 1);
          }, 10);
          return mockProc;
        },
        healthCheck: async () => true,
      };

      const exitSession = new DaemonBridgeSession(exitDaemon, 'token', 'model', '/cwd');
      const chunks: StreamChunk[] = [];

      for await (const chunk of exitSession.send([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(1);
      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('Process exited with code 1');
    });
  });

  describe('dispose', () => {
    it('kills the daemon process', async () => {
      setTimeout(() => {
        daemon.emitOutput([
          JSON.stringify({ jsonrpc: '2.0', method: 'chat/done', params: { id: 1, finishReason: 'stop' } }),
        ]);
      }, 10);

      for await (const _chunk of session.send([{ role: 'user', content: 'Hi' }])) {
        // consume all chunks
      }

      await session.dispose();

      expect(daemon.lastProc.kill).toHaveBeenCalled();
    });
  });
});
