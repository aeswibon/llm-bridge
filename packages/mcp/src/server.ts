import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import http from "node:http";

const BRIDGE_PORT = Number(process.env.LLM_BRIDGE_PORT ?? "3849");
const BRIDGE_HOST = process.env.LLM_BRIDGE_HOST ?? "127.0.0.1";

function bridgeUrl(path: string): string {
  return `http://${BRIDGE_HOST}:${BRIDGE_PORT}${path}`;
}

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

const mcpServer = new McpServer(
  { name: "llm-bridge-mcp", version: "2.0.0" },
  {
    instructions: "Manage llm-bridge: check status, list models, generate OpenCode config.",
  }
);

mcpServer.registerTool(
  "bridge_status",
  { description: "Check llm-bridge server health and status." },
  async () => {
    try {
      const res = await fetchJson(bridgeUrl("/health"));
      if (res.status === 200) {
        return { content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }] };
      }
      return { content: [{ type: "text", text: `Bridge unhealthy: status ${res.status}` }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `Cannot reach bridge: ${msg}` }] };
    }
  }
);

mcpServer.registerTool(
  "list_models",
  { description: "List available models from the active provider." },
  async () => {
    try {
      const res = await fetchJson(bridgeUrl("/v1/models"));
      if (res.status === 200) {
        const modelIds = res.body.data?.map((m: any) => m.id) ?? [];
        return { content: [{ type: "text", text: `Available models: ${modelIds.join(", ")}` }] };
      }
      return { content: [{ type: "text", text: `Failed to list models: ${JSON.stringify(res.body)}` }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: "text", text: `Cannot reach bridge: ${msg}` }] };
    }
  }
);

mcpServer.registerTool(
  "generate_opencode_config",
  {
    description: "Generate an OpenCode provider fragment for the bridge.",
    inputSchema: {
      providerId: z.string().optional().describe("Provider key (default: llm-bridge)."),
      modelId: z.string().optional().describe("Model id (default: composer-2)."),
    },
  },
  async ({ providerId, modelId }) => {
    const pid = providerId ?? "llm-bridge";
    const mid = modelId ?? "composer-2";
    const fragment = {
      provider: {
        [pid]: {
          npm: "@ai-sdk/openai-compatible",
          name: "LLM Bridge",
          options: {
            apiKey: "bridge-local",
            baseURL: bridgeUrl("/v1"),
          },
          models: { [mid]: { name: mid } },
        },
      },
    };
    return {
      content: [{ type: "text", text: `Merge into opencode.json:\n\n${JSON.stringify(fragment, null, 2)}` }],
    };
  }
);

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
