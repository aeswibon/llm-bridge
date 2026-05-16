import http from "node:http";
import { z } from "zod";
import { MessageSchema, ToolDefinitionSchema } from "./types.js";

const ChatRequestSchema = z.object({
  model: z.string().min(1, "model is required"),
  messages: z.array(MessageSchema).min(1, "messages must have at least one message"),
  stream: z.boolean().optional().default(false),
  tools: z.array(ToolDefinitionSchema).optional(),
  tool_choice: z.unknown().optional(),
});

export type ParsedChatRequest = z.infer<typeof ChatRequestSchema>;

export async function parseChatRequest(
  req: http.IncomingMessage
): Promise<{ success: true; data: ParsedChatRequest } | { success: false; error: string }> {
  try {
    const body = await readBody(req);
    const json = JSON.parse(body);
    const result = ChatRequestSchema.safeParse(json);
    if (!result.success) {
      return { success: false, error: result.error.errors[0].message };
    }
    return { success: true, data: result.data };
  } catch (e) {
    if (e instanceof SyntaxError) {
      return { success: false, error: "Invalid JSON body" };
    }
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export function parseModelsRequest(_req: http.IncomingMessage): { success: true } | { success: false; error: string } {
  return { success: true };
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
