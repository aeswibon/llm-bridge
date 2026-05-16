import { describe, it, expect } from "vitest";
import { parseChatRequest } from "../src/parser.js";
import http from "node:http";

function createRequest(body: any, headers: Record<string, string> = {}): http.IncomingMessage {
  const req = new http.IncomingMessage({} as any);
  req.headers = { "content-type": "application/json", ...headers };
  (req as any)._read = () => {};
  process.nextTick(() => {
    req.emit("data", Buffer.from(JSON.stringify(body)));
    req.emit("end");
  });
  return req;
}

describe("parseChatRequest", () => {
  it("parses valid chat request", async () => {
    const req = createRequest({
      model: "composer-2",
      messages: [{ role: "user", content: "Hello" }],
      stream: true,
    });
    const result = await parseChatRequest(req);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.model).toBe("composer-2");
      expect(result.data.messages).toHaveLength(1);
      expect(result.data.stream).toBe(true);
    }
  });

  it("rejects missing model", async () => {
    const req = createRequest({ messages: [{ role: "user", content: "Hello" }] });
    const result = await parseChatRequest(req);
    expect(result.success).toBe(false);
  });

  it("rejects missing messages", async () => {
    const req = createRequest({ model: "composer-2" });
    const result = await parseChatRequest(req);
    expect(result.success).toBe(false);
  });

  it("defaults stream to false", async () => {
    const req = createRequest({
      model: "composer-2",
      messages: [{ role: "user", content: "Hello" }],
    });
    const result = await parseChatRequest(req);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stream).toBe(false);
    }
  });
});
