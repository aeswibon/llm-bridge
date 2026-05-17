import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDaemonManager } from '../src/daemon.js';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
      writeFileSync(knownPath, '#!/bin/bash\necho known');

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
  });

  describe('spawn', () => {
    it('spawns a process with stdio pipes', () => {
      const manager = createDaemonManager({
        binaryName: 'echo',
        downloadUrl: 'https://example.com/binary',
        checksum: 'abc123',
        knownPaths: [],
      });

      const proc = manager.spawn(['hello']);
      expect(proc.stdin).not.toBeNull();
      expect(proc.stdout).not.toBeNull();
      expect(proc.stderr).not.toBeNull();

      proc.kill();
    });
  });
});
