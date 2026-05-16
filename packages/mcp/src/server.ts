#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BRIDGE_PORT = Number(process.env.LLM_BRIDGE_PORT ?? "3849");
const BRIDGE_HOST = process.env.LLM_BRIDGE_HOST ?? "127.0.0.1";

function bridgeUrl(path: string): string {
  return `http://${BRIDGE_HOST}:${BRIDGE_PORT}${path}`;
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "llm-bridge-mcp", version: "2.0.0" },
    {
      instructions: "Manage llm-bridge: check status, list models, generate OpenCode config.",
    }
  );

  server.registerTool(
    "bridge_status",
    { description: "Check llm-bridge server health and status." },
    async () => {
      try {
        const res = await fetch(bridgeUrl("/health"));
        const body = await res.json();
        if (res.ok) {
          return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
        }
        return { content: [{ type: "text", text: `Bridge unhealthy: status ${res.status}` }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `Cannot reach bridge: ${msg}` }] };
      }
    }
  );

  server.registerTool(
    "list_models",
    { description: "List available models from the active provider." },
    async () => {
      try {
        const res = await fetch(bridgeUrl("/v1/models"));
        const body = await res.json();
        if (res.ok) {
          const modelIds = body.data?.map((m: any) => m.id) ?? [];
          return { content: [{ type: "text", text: `Available models: ${modelIds.join(", ")}` }] };
        }
        return { content: [{ type: "text", text: `Failed to list models: ${JSON.stringify(body)}` }] };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { content: [{ type: "text", text: `Cannot reach bridge: ${msg}` }] };
      }
    }
  );

  server.registerTool(
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

  return server;
}

async function main(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const entry = process.argv[1];
if (entry && new URL(import.meta.url).pathname.endsWith(entry.split("/").pop()!)) {
  void main();
}
