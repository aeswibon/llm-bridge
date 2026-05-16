import { z } from 'zod';

export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool', 'function']),
  content: z.string().nullable().optional(),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export const ToolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.unknown()),
  }),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const ModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  capabilities: z
    .object({
      streaming: z.boolean().optional(),
      tools: z.boolean().optional(),
      vision: z.boolean().optional(),
    })
    .optional(),
});

export type ModelInfo = z.infer<typeof ModelInfoSchema>;

export type StreamChunkType = 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
export type FinishReason = 'stop' | 'tool_calls' | 'error' | 'length';

export interface StreamChunk {
  type: StreamChunkType;
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  finishReason?: FinishReason;
}

export interface BridgePlugin {
  name: string;
  version: string;
  authenticate(config: Record<string, string>): Promise<boolean>;
  listModels(config: Record<string, string>): Promise<ModelInfo[]>;
  createSession(config: Record<string, string>, model: string): Promise<BridgeSession>;
}

export interface BridgeSession {
  send(messages: Message[], tools?: ToolDefinition[]): AsyncIterable<StreamChunk>;
  dispose(): Promise<void>;
}

export interface PluginHealth {
  name: string;
  healthy: boolean;
  lastChecked: Date;
  error?: string;
}

export interface BridgeConfig {
  activePlugin: string;
  port: number;
  host: string;
  plugins: Record<string, Record<string, string>>;
  sessionTTL: number;
  toolMode: 'strict' | 'lenient';
}

export const DefaultConfig: BridgeConfig = {
  activePlugin: 'cursor',
  port: 3849,
  host: '127.0.0.1',
  plugins: {},
  sessionTTL: 1800,
  toolMode: 'lenient',
};
