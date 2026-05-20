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

  it('injects provider with single model into empty config', () => {
    const models = { 'cursor/composer-2': { name: 'cursor/composer-2' } };
    injectProvider(tmpFile, 'test-provider', models, 3849, 'cursor/composer-2');
    const config = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    expect(config.provider['test-provider']).toBeDefined();
    expect(config.provider['test-provider'].options.baseURL).toBe('http://127.0.0.1:3849/v1');
    expect(config.provider['test-provider'].models['cursor/composer-2']).toBeDefined();
    expect(config.model).toBe('test-provider/cursor/composer-2');
  });

  it('injects provider with multiple models', () => {
    const models = {
      'cursor/composer-2': { name: 'cursor/composer-2' },
      'cursor/gpt-4o': { name: 'cursor/gpt-4o' },
    };
    injectProvider(tmpFile, 'test-provider', models, 3849, 'cursor/gpt-4o');
    const config = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    expect(config.provider['test-provider'].models['cursor/composer-2']).toBeDefined();
    expect(config.provider['test-provider'].models['cursor/gpt-4o']).toBeDefined();
    expect(config.model).toBe('test-provider/cursor/gpt-4o');
  });

  it('preserves existing config fields', () => {
    fs.writeFileSync(tmpFile, JSON.stringify({ existing: 'value' }));
    const models = { 'cursor/composer-2': { name: 'cursor/composer-2' } };
    injectProvider(tmpFile, 'test-provider', models, 3849, 'cursor/composer-2');
    const config = JSON.parse(fs.readFileSync(tmpFile, 'utf8'));
    expect(config.existing).toBe('value');
    expect(config.provider['test-provider']).toBeDefined();
  });
});
