import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDaemonManager } from '../src/daemon.js';
import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('createDaemonManager', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `llm-bridge-daemon-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('locate', () => {
    it('returns null when binary is not found anywhere', async () => {
      const manager = createDaemonManager({
        binaryName: 'nonexistent-binary-xyz',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
      });

      const result = await manager.locate();
      expect(result).toBeNull();
    });

    it('finds binary from envVar', async () => {
      const binaryPath = join(testDir, 'test-binary');
      writeFileSync(binaryPath, '#!/bin/bash\necho hello');
      chmodSync(binaryPath, 0o755);

      const manager = createDaemonManager({
        binaryName: 'test-binary',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
        envVar: 'TEST_BINARY_PATH',
      });

      process.env.TEST_BINARY_PATH = binaryPath;
      const result = await manager.locate();
      delete process.env.TEST_BINARY_PATH;

      expect(result).toBe(binaryPath);
    });

    it('finds binary from knownPaths', async () => {
      const binaryPath = join(testDir, 'known-binary');
      writeFileSync(binaryPath, '#!/bin/bash\necho hello');
      chmodSync(binaryPath, 0o755);

      const manager = createDaemonManager({
        binaryName: 'known-binary',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [binaryPath, '/nonexistent/path/binary'],
      });

      const result = await manager.locate();
      expect(result).toBe(binaryPath);
    });

    it('finds binary from ~/.llm-bridge/daemons/', async () => {
      const daemonsDir = join(testDir, '.llm-bridge', 'daemons');
      mkdirSync(daemonsDir, { recursive: true });
      const binaryPath = join(daemonsDir, 'managed-binary');
      writeFileSync(binaryPath, '#!/bin/bash\necho hello');
      chmodSync(binaryPath, 0o755);

      const manager = createDaemonManager({
        binaryName: 'managed-binary',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
        daemonsDir,
      });

      const result = await manager.locate();

      expect(result).toBe(binaryPath);
    });

    it('checks envVar before knownPaths', async () => {
      const envPath = join(testDir, 'env-binary');
      const knownPath = join(testDir, 'known-binary');
      writeFileSync(envPath, '#!/bin/bash\necho env');
      chmodSync(envPath, 0o755);
      writeFileSync(knownPath, '#!/bin/bash\necho known');
      chmodSync(knownPath, 0o755);

      const manager = createDaemonManager({
        binaryName: 'test-binary',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [knownPath],
        envVar: 'TEST_BINARY_PATH',
      });

      process.env.TEST_BINARY_PATH = envPath;
      const result = await manager.locate();
      delete process.env.TEST_BINARY_PATH;

      expect(result).toBe(envPath);
    });

    it('skips non-executable files in knownPaths', async () => {
      const nonExecPath = join(testDir, 'non-exec-binary');
      const execPath = join(testDir, 'exec-binary');
      writeFileSync(nonExecPath, '#!/bin/bash\necho nonexec');
      chmodSync(nonExecPath, 0o644);
      writeFileSync(execPath, '#!/bin/bash\necho exec');
      chmodSync(execPath, 0o755);

      const manager = createDaemonManager({
        binaryName: 'test-binary',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [nonExecPath, execPath],
      });

      const result = await manager.locate();
      expect(result).toBe(execPath);
    });

    it('skips non-executable file from envVar', async () => {
      const nonExecPath = join(testDir, 'non-exec-env-binary');
      writeFileSync(nonExecPath, '#!/bin/bash\necho nonexec');
      chmodSync(nonExecPath, 0o644);

      const manager = createDaemonManager({
        binaryName: 'test-binary',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
        envVar: 'TEST_BINARY_PATH',
      });

      process.env.TEST_BINARY_PATH = nonExecPath;
      const result = await manager.locate();
      delete process.env.TEST_BINARY_PATH;

      expect(result).toBeNull();
    });
  });

  describe('spawn', () => {
    it('spawns a process with stdio pipes using provided binary path', () => {
      const manager = createDaemonManager({
        binaryName: 'echo',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
      });

      const proc = manager.spawn('/bin/echo', ['hello']);
      expect(proc.stdin).not.toBeNull();
      expect(proc.stdout).not.toBeNull();
      expect(proc.stderr).not.toBeNull();

      proc.kill();
    });
  });

  describe('download', () => {
    let server: Server;
    let port: number;

    afterEach(() => {
      if (server) {
        server.close();
      }
    });

    function startServer(
      handler: (
        req: import('node:http').IncomingMessage,
        res: import('node:http').ServerResponse,
      ) => void,
    ): Promise<number> {
      return new Promise((resolve) => {
        server = createServer(handler);
        server.listen(0, () => {
          port = (server.address() as import('node:net').AddressInfo).port;
          resolve(port);
        });
      });
    }

    it('downloads a binary and makes it executable', async () => {
      const content = '#!/bin/bash\necho hello';
      const checksum = 'ce4d2c05413f9716411aa45c7fe16dc19edd3a88249732eaae5cefee4fc8bd63';

      await startServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(content);
      });

      const manager = createDaemonManager({
        binaryName: 'test-daemon',
        downloadUrl: `http://localhost:${port}/binary`,
        checksum,
        knownPaths: [],
        daemonsDir: testDir,
      });

      const result = await manager.download();
      expect(result).toBe(join(testDir, 'test-daemon'));
      expect(existsSync(result)).toBe(true);

      const stats = statSync(result);
      expect(stats.mode & 0o755).toBe(0o755);
    });

    it('follows redirects up to the limit', async () => {
      const content = '#!/bin/bash\necho hello';
      const checksum = 'ce4d2c05413f9716411aa45c7fe16dc19edd3a88249732eaae5cefee4fc8bd63';
      let redirectCount = 0;

      await startServer((_req, res) => {
        redirectCount++;
        if (redirectCount < 3) {
          res.writeHead(302, { Location: `http://localhost:${port}/step${redirectCount}` });
          res.end();
        } else {
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
          res.end(content);
        }
      });

      const manager = createDaemonManager({
        binaryName: 'redirect-daemon',
        downloadUrl: `http://localhost:${port}/step0`,
        checksum,
        knownPaths: [],
        daemonsDir: testDir,
      });

      const result = await manager.download();
      expect(result).toBe(join(testDir, 'redirect-daemon'));
      expect(redirectCount).toBe(3);
    });

    it('cleans up file on checksum mismatch', async () => {
      const content = '#!/bin/bash\necho hello';

      await startServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(content);
      });

      const manager = createDaemonManager({
        binaryName: 'bad-checksum-daemon',
        downloadUrl: `http://localhost:${port}/binary`,
        checksum: '0000000000000000000000000000000000000000000000000000000000000000',
        knownPaths: [],
        daemonsDir: testDir,
      });

      await expect(manager.download()).rejects.toThrow('Checksum mismatch');
      expect(existsSync(join(testDir, 'bad-checksum-daemon'))).toBe(false);
    });

    it('rejects on too many redirects', async () => {
      await startServer((_req, res) => {
        res.writeHead(302, { Location: `http://localhost:${port}/next` });
        res.end();
      });

      const manager = createDaemonManager({
        binaryName: 'loop-daemon',
        downloadUrl: `http://localhost:${port}/start`,
        checksum: 'abc123',
        knownPaths: [],
        daemonsDir: testDir,
      });

      await expect(manager.download()).rejects.toThrow('Too many redirects');
    });

    it('rejects on non-200 status', async () => {
      await startServer((_req, res) => {
        res.writeHead(404);
        res.end();
      });

      const manager = createDaemonManager({
        binaryName: 'notfound-daemon',
        downloadUrl: `http://localhost:${port}/binary`,
        checksum: 'abc123',
        knownPaths: [],
        daemonsDir: testDir,
      });

      await expect(manager.download()).rejects.toThrow('Download failed: 404');
    });

    it('rejects on hard timeout even with slow drip', async () => {
      await startServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.write('x');
      });

      const manager = createDaemonManager({
        binaryName: 'slow-daemon',
        downloadUrl: `http://localhost:${port}/binary`,
        checksum: 'abc123',
        knownPaths: [],
        daemonsDir: testDir,
      });

      await expect(manager.download()).rejects.toThrow('Download timeout (30s)');
    }, 35000);

    it('rejects redirect to file:// protocol', async () => {
      await startServer((_req, res) => {
        res.writeHead(302, { Location: 'file:///etc/passwd' });
        res.end();
      });

      const manager = createDaemonManager({
        binaryName: 'scheme-daemon',
        downloadUrl: `http://localhost:${port}/binary`,
        checksum: 'abc123',
        knownPaths: [],
        daemonsDir: testDir,
      });

      await expect(manager.download()).rejects.toThrow('Redirect to unsupported protocol: file:');
    });

    it('rejects when download exceeds size limit', async () => {
      const chunkSize = 1 * 1024 * 1024; // 1MB chunks
      let totalSent = 0;

      await startServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        const sendChunk = () => {
          totalSent += chunkSize;
          if (!res.write(Buffer.alloc(chunkSize, 0))) {
            res.once('drain', sendChunk);
          } else if (totalSent < 10 * 1024 * 1024) {
            setImmediate(sendChunk);
          } else {
            res.end();
          }
        };
        sendChunk();
      });

      const manager = createDaemonManager({
        binaryName: 'big-daemon',
        downloadUrl: `http://localhost:${port}/binary`,
        checksum: 'abc123',
        knownPaths: [],
        daemonsDir: testDir,
      });

      await expect(manager.download()).rejects.toThrow('Download exceeds maximum size');
    }, 15000);
  });

  describe('healthCheck', () => {
    let server: Server;
    let healthPort: number;

    afterEach(() => {
      if (server) {
        server.close();
      }
    });

    function startHealthServer(
      handler: (
        req: import('node:http').IncomingMessage,
        res: import('node:http').ServerResponse,
      ) => void,
    ): Promise<number> {
      return new Promise((resolve) => {
        server = createServer(handler);
        server.listen(0, () => {
          healthPort = (server.address() as import('node:net').AddressInfo).port;
          resolve(healthPort);
        });
      });
    }

    it('returns false when binary not found', async () => {
      const manager = createDaemonManager({
        binaryName: 'nonexistent-health',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
      });

      const result = await manager.healthCheck();
      expect(result).toBe(false);
    });

    it('returns true when binary exists and no port provided', async () => {
      const binaryPath = join(testDir, 'test-binary');
      writeFileSync(binaryPath, '#!/bin/bash\necho hello');
      chmodSync(binaryPath, 0o755);

      const manager = createDaemonManager({
        binaryName: 'test-binary',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
        envVar: 'TEST_BINARY_PATH',
      });

      process.env.TEST_BINARY_PATH = binaryPath;
      const result = await manager.healthCheck();
      delete process.env.TEST_BINARY_PATH;

      expect(result).toBe(true);
    });

    it('returns true when health endpoint responds 200', async () => {
      const binaryPath = join(testDir, 'test-binary');
      writeFileSync(binaryPath, '#!/bin/bash\necho hello');
      chmodSync(binaryPath, 0o755);

      await startHealthServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200);
          res.end('OK');
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      const manager = createDaemonManager({
        binaryName: 'test-binary',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
        envVar: 'TEST_BINARY_PATH',
      });

      process.env.TEST_BINARY_PATH = binaryPath;
      const result = await manager.healthCheck(healthPort);
      delete process.env.TEST_BINARY_PATH;

      expect(result).toBe(true);
    });

    it('returns false when health endpoint responds non-200', async () => {
      const binaryPath = join(testDir, 'test-binary');
      writeFileSync(binaryPath, '#!/bin/bash\necho hello');
      chmodSync(binaryPath, 0o755);

      await startHealthServer((_req, res) => {
        res.writeHead(500);
        res.end();
      });

      const manager = createDaemonManager({
        binaryName: 'test-binary',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
        envVar: 'TEST_BINARY_PATH',
      });

      process.env.TEST_BINARY_PATH = binaryPath;
      const result = await manager.healthCheck(healthPort);
      delete process.env.TEST_BINARY_PATH;

      expect(result).toBe(false);
    });

    it('returns false when health endpoint is unreachable', async () => {
      const binaryPath = join(testDir, 'test-binary');
      writeFileSync(binaryPath, '#!/bin/bash\necho hello');
      chmodSync(binaryPath, 0o755);

      const manager = createDaemonManager({
        binaryName: 'test-binary',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
        envVar: 'TEST_BINARY_PATH',
      });

      process.env.TEST_BINARY_PATH = binaryPath;
      const result = await manager.healthCheck(59999);
      delete process.env.TEST_BINARY_PATH;

      expect(result).toBe(false);
    });
  });
});
