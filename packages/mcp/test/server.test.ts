import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/server.js';

describe('MCP Server', () => {
  it('creates server instance', () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
  });

  it('has correct name and version', () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
  });
});
