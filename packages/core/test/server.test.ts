import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { BridgeServer } from '../src/server.js';
import type { BridgePlugin, BridgeSession, ModelInfo, StreamChunk } from '../src/types.js';

function fetchJson(url: string, options?: { method?: string; body?: string }): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request(
      urlObj,
      {
        method: options?.method ?? 'GET',
        headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      },
    );
    req.on('error', reject);
    if (options?.body) req.write(options.body);
    req.end();
  });
}

class MockPlugin implements BridgePlugin {
  name = 'mock';
  version = '1.0.0';
  async authenticate(): Promise<boolean> {
    return true;
  }
  async listModels(): Promise<ModelInfo[]> {
    return [{ id: 'mock-model', name: 'Mock Model' }];
  }
  async createSession(): Promise<BridgeSession> {
    return new MockSession();
  }
}

class MockSession implements BridgeSession {
  async *send(): AsyncIterable<StreamChunk> {
    yield { type: 'text', content: 'Hello from mock' };
    yield { type: 'done', finishReason: 'stop' };
  }
  async dispose(): Promise<void> {}
}

describe('BridgeServer', () => {
  let server: BridgeServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new BridgeServer({ port: 0, host: '127.0.0.1' });
    server.registerPlugin(new MockPlugin());
    server.setActivePlugin('mock');
    server.setDefaultPlugin('mock');
    await server.start();
    const address = server.address();
    baseUrl = `http://127.0.0.1:${(address as any).port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it('returns health status', async () => {
    const res = await fetchJson(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe('llm-bridge');
  });

  it('returns 404 for unknown routes', async () => {
    const res = await fetchJson(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });

  it('lists models from active plugin', async () => {
    const res = await fetchJson(`${baseUrl}/v1/models`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('mock/mock-model');
  });

  it('completes chat request (non-streaming)', async () => {
    const res = await fetchJson(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.body.choices[0].message.content).toBe('Hello from mock');
    expect(res.body.choices[0].finish_reason).toBe('stop');
  });

  it('returns 503 when no active plugin', async () => {
    const s = new BridgeServer({ port: 0, host: '127.0.0.1' });
    await s.start();
    const addr = s.address();
    const url = `http://127.0.0.1:${(addr as any).port}`;
    const res = await fetchJson(`${url}/v1/models`);
    expect(res.status).toBe(503);
    await s.stop();
  });
});

class MockPlugin2 implements BridgePlugin {
  name = 'mock2';
  version = '1.0.0';
  async authenticate(): Promise<boolean> { return true; }
  async listModels(): Promise<ModelInfo[]> {
    return [{ id: 'mock2-model', name: 'Mock2 Model' }];
  }
  async createSession(): Promise<BridgeSession> {
    return new MockSession2();
  }
}

class MockSession2 implements BridgeSession {
  async *send(): AsyncIterable<StreamChunk> {
    yield { type: 'text', content: 'Hello from mock2' };
    yield { type: 'done', finishReason: 'stop' };
  }
  async dispose(): Promise<void> {}
}

describe('BridgeServer multi-plugin routing', () => {
  let server: BridgeServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new BridgeServer({ port: 0, host: '127.0.0.1' });
    server.registerPlugin(new MockPlugin());
    server.registerPlugin(new MockPlugin2());
    server.setDefaultPlugin('mock');
    await server.start();
    const address = server.address();
    baseUrl = `http://127.0.0.1:${(address as any).port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it('aggregates models from all plugins with prefixes', async () => {
    const res = await fetchJson(`${baseUrl}/v1/models`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const ids = res.body.data.map((m: any) => m.id);
    expect(ids).toContain('mock/mock-model');
    expect(ids).toContain('mock2/mock2-model');
  });

  it('routes prefixed model to correct plugin', async () => {
    const res = await fetchJson(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model: 'mock2/mock2-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.body.choices[0].message.content).toBe('Hello from mock2');
  });

  it('routes unprefixed model to default plugin', async () => {
    const res = await fetchJson(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model: 'mock-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.body.choices[0].message.content).toBe('Hello from mock');
  });

  it('returns 400 for unknown plugin prefix', async () => {
    const res = await fetchJson(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      body: JSON.stringify({
        model: 'unknown/some-model',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: false,
      }),
    });
    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe('invalid_request_error');
  });
});
