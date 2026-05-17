import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WindsurfBridgeSession } from '../src/session.js';
import type { Message, StreamChunk, DaemonManager } from '@ai-ide-bridge/core';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

function createMockDaemon(): DaemonManager {
  const mockStdout = new EventEmitter() as NodeJS.ReadableStream;
  const mockStdin = new EventEmitter() as NodeJS.WritableStream;
  (mockStdin as any).write = vi.fn(() => true);

  const mockProc = new EventEmitter() as ChildProcess;
  mockProc.stdin = mockStdin;
  mockProc.stdout = mockStdout;
  mockProc.stderr = new EventEmitter();
  (mockProc as any).kill = vi.fn(() => true);
  (mockProc as any).pid = 12345;

  return {
    binaryName: 'mock-language-server',
    locate: async () => '/mock/path',
    download: async () => '/mock/path',
    spawn: vi.fn(() => mockProc),
    healthCheck: async () => true,
  };
}

describe('WindsurfBridgeSession', () => {
  let daemon: DaemonManager;
  let session: WindsurfBridgeSession;

  beforeEach(() => {
    daemon = createMockDaemon();
    session = new WindsurfBridgeSession(daemon, 'test-token', 'claude-4.5-sonnet', '/test/cwd');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends messages and receives text response', async () => {
    const proc = daemon.spawn('/mock/path', []);

    setTimeout(() => {
      (proc.stdout as EventEmitter).emit(
        'data',
        Buffer.from(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'chat/chunk',
            params: { id: 1, delta: { content: 'Hello!' } },
          }) +
            '\n' +
            JSON.stringify({
              jsonrpc: '2.0',
              method: 'chat/done',
              params: { id: 1, finishReason: 'stop' },
            }) +
            '\n',
        ),
      );
    }, 10);

    const messages: Message[] = [{ role: 'user', content: 'Hi' }];
    const chunks: StreamChunk[] = [];

    for await (const chunk of session.send(messages)) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ type: 'text', content: 'Hello!' });
    expect(chunks[1]).toEqual({ type: 'done', finishReason: 'stop' });
  });

  it('disposes the daemon process', async () => {
    const proc = daemon.spawn('/mock/path', []) as any;

    setTimeout(() => {
      (proc.stdout as EventEmitter).emit(
        'data',
        Buffer.from(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'chat/done',
            params: { id: 1, finishReason: 'stop' },
          }) + '\n',
        ),
      );
    }, 10);

    const messages: Message[] = [{ role: 'user', content: 'Hi' }];
    for await (const _chunk of session.send(messages)) {
      // consume iterator to ensure proc is spawned
    }

    await session.dispose();
    expect(proc.kill).toHaveBeenCalled();
  });
});
