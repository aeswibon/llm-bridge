import { describe, it, expect, beforeEach } from 'vitest';
import { injectProvider } from '../src/utils/opencode.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('opencode utils', () => {
  let tmpFile: string;

  beforeEach(() => {
    tmpFile = path.join(os.tmpdir(), `opencode-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, '{}');
  });

  it('injects provider into empty config', () => {
    injectProvider(tmpFile, 'test-provider', 'test-model', 3849);
    const config = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    expect(config.provider['test-provider']).toBeDefined();
    expect(config.provider['test-provider'].options.baseURL).toBe('http://127.0.0.1:3849/v1');
    expect(config.model).toBe('test-provider/test-model');
  });

  it('preserves existing config fields', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({ existing: 'value' }));
    injectProvider(tmpFile, 'test-provider', 'test-model', 3849);
    const config = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    expect(config.existing).toBe('value');
    expect(config.provider['test-provider']).toBeDefined();
  });
});
