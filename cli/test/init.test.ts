import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('initCommand', () => {
  let tmpDir: string;
  let configDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-bridge-init-test-'));
    configDir = path.join(tmpDir, '.config', 'llm-bridge');
    fs.mkdirSync(configDir, { recursive: true });
    vi.spyOn(os, 'homedir').mockReturnValue(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes config with single provider', async () => {
    const config = {
      defaultPlugin: 'cursor',
      port: 3849,
      host: '127.0.0.1',
      plugins: { cursor: { CURSOR_API_KEY: 'test-api-key' } },
      sessionTTL: 1800,
      toolMode: 'lenient',
    };

    const configPath = path.join(configDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(loaded.defaultPlugin).toBe('cursor');
    expect(loaded.plugins.cursor.CURSOR_API_KEY).toBe('test-api-key');
  });

  it('writes config with multiple providers', async () => {
    const config = {
      defaultPlugin: 'cursor',
      port: 3849,
      host: '127.0.0.1',
      plugins: {
        cursor: { CURSOR_API_KEY: 'test-api-key' },
        windsurf: { WINDSURF_TOKEN: 'test-windsurf-token' },
      },
      sessionTTL: 1800,
      toolMode: 'lenient',
    };

    const configPath = path.join(configDir, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    expect(loaded.defaultPlugin).toBe('cursor');
    expect(loaded.plugins.cursor.CURSOR_API_KEY).toBe('test-api-key');
    expect(loaded.plugins.windsurf.WINDSURF_TOKEN).toBe('test-windsurf-token');
  });
});
