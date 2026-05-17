import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWindsurfDaemon } from '../src/daemon.js';
import { existsSync, mkdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('createWindsurfDaemon', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `windsurf-daemon-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe('locate', () => {
    it('returns null when binary is not found', async () => {
      const daemon = createWindsurfDaemon();
      const originalHome = process.env.HOME;
      process.env.HOME = testDir;

      const result = await daemon.locate();
      process.env.HOME = originalHome;

      expect(result).toBeNull();
    });

    it('finds binary from WINDSURF_LANGUAGE_SERVER_PATH envVar', async () => {
      const binaryPath = join(testDir, 'language_server');
      writeFileSync(binaryPath, '#!/bin/bash\necho hello');
      chmodSync(binaryPath, 0o755);

      const daemon = createWindsurfDaemon();
      process.env.WINDSURF_LANGUAGE_SERVER_PATH = binaryPath;

      const result = await daemon.locate();
      delete process.env.WINDSURF_LANGUAGE_SERVER_PATH;

      expect(result).toBe(binaryPath);
    });

    it('finds binary from knownPaths', async () => {
      const binaryPath = join(testDir, 'language_server');
      writeFileSync(binaryPath, '#!/bin/bash\necho hello');
      chmodSync(binaryPath, 0o755);

      const daemon = createWindsurfDaemon({
        knownPaths: [binaryPath],
      });

      const result = await daemon.locate();
      expect(result).toBe(binaryPath);
    });
  });

  describe('spawn', () => {
    it('spawns the language server with stdio pipes', () => {
      const daemon = createWindsurfDaemon();
      const proc = daemon.spawn('/bin/echo', []);
      expect(proc.stdin).not.toBeNull();
      expect(proc.stdout).not.toBeNull();
      expect(proc.stderr).not.toBeNull();
      proc.kill();
    });
  });
});
