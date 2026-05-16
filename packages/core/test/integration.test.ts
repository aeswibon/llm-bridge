import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { BridgeServer } from "../src/server.js";
import type { BridgePlugin, BridgeSession, ModelInfo, StreamChunk } from "../src/types.js";
import http from "node:http";

// Mock plugin for testing
class MockPlugin implements BridgePlugin {
  name = "mock";
  version = "1.0.0";

  async authenticate(): Promise<boolean> { return true; }

  async listModels(): Promise<ModelInfo[]> {
    return [{ id: "mock-model", name: "Mock Model", capabilities: { streaming: true, tools: true } }];
  }

  async createSession(): Promise<BridgeSession> {
    return new MockSession();
  }
}

class MockSession implements BridgeSession {
  async *send(): AsyncIterable<StreamChunk> {
    yield { type: "text", content: "Hello from mock" };
    yield { type: "done", finishReason: "stop" };
  }

  async dispose(): Promise<void> {}
}

function fetchJson(url: string, options?: { method?: string; body?: string }): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request(urlObj, {
      method: options?.method ?? "GET",
      headers: { "Content-Type": "application/json" },
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (options?.body) req.write(options.body);
    req.end();
  });
}

describe("E2E integration test", () => {
  let server: BridgeServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new BridgeServer({ port: 0, host: "127.0.0.1" });
    server.registerPlugin(new MockPlugin());
    server.setActivePlugin("mock");
    await server.start();
    const address = server.address();
    baseUrl = `http://127.0.0.1:${(address as any).port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it("health endpoint returns ok", async () => {
    const res = await fetchJson(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("lists models from active plugin", async () => {
    const res = await fetchJson(`${baseUrl}/v1/models`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe("mock-model");
  });

  it("completes chat request (non-streaming)", async () => {
    const res = await fetchJson(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      body: JSON.stringify({
        model: "mock-model",
        messages: [{ role: "user", content: "Hello" }],
        stream: false,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.body.choices[0].message.content).toBe("Hello from mock");
    expect(res.body.choices[0].finish_reason).toBe("stop");
  });

  it("completes chat request (streaming)", async () => {
    const res = await new Promise<string>((resolve, reject) => {
      const urlObj = new URL(`${baseUrl}/v1/chat/completions`);
      const req = http.request(urlObj, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      });
      req.on("error", reject);
      req.write(JSON.stringify({
        model: "mock-model",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      }));
      req.end();
    });

    expect(res).toContain("data:");
    expect(res).toContain("Hello from mock");
    expect(res).toContain("[DONE]");
  });
});
