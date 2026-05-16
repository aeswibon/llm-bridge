import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { BridgeServer } from "../src/server.js";

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on("error", reject);
  });
}

describe("BridgeServer", () => {
  let server: BridgeServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = new BridgeServer({ port: 0, host: "127.0.0.1" });
    await server.start();
    const address = server.address();
    baseUrl = `http://127.0.0.1:${(address as any).port}`;
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns health status", async () => {
    const res = await fetchJson(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toBe("llm-bridge");
  });

  it("returns 404 for unknown routes", async () => {
    const res = await fetchJson(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
  });
});
