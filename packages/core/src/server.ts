import http, { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import { BridgeConfig, DefaultConfig, BridgePlugin, StreamChunk } from './types.js';
import { parseChatRequest } from './parser.js';
import { PluginRegistry } from './registry.js';
import { SessionStore } from './session.js';
import { formatStreamChunk, formatCompletion } from './formatter.js';

export class BridgeServer {
  private server: http.Server | null = null;
  private registry: PluginRegistry;
  private sessions: SessionStore;
  private config: BridgeConfig;

  constructor(config: Partial<BridgeConfig> = {}) {
    this.config = { ...DefaultConfig, ...config };
    this.registry = new PluginRegistry();
    this.sessions = new SessionStore(this.config.sessionTTL);
  }

  async start(): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        console.error('[llm-bridge] unhandled error:', err);
        if (!res.headersSent) {
          this.jsonResponse(res, 500, { error: { message: 'internal error', type: 'internal' } });
        }
      });
    });

    this.sessions.startCleanup();

    return new Promise((resolve) => {
      this.server!.listen(this.config.port, this.config.host, () => {
        const address = this.server!.address();
        const port = typeof address === 'object' ? address?.port : this.config.port;
        console.error(`[llm-bridge] listening on http://${this.config.host}:${port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.sessions.stopCleanup();
    await this.sessions.disposeAll();
    return new Promise((resolve) => {
      this.server?.close(() => resolve());
    });
  }

  address(): import('net').AddressInfo | string | null {
    return this.server?.address() ?? null;
  }

  private async handleRequest(req: IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${this.config.host}`);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (req.method === 'GET' && path === '/health') {
      this.jsonResponse(res, 200, { ok: true, service: 'llm-bridge' });
      return;
    }

    if (req.method === 'GET' && path === '/v1/models') {
      await this.handleModels(req, res);
      return;
    }

    if (req.method === 'POST' && path === '/v1/chat/completions') {
      await this.handleChatCompletions(req, res);
      return;
    }

    this.jsonResponse(res, 404, { error: { message: `Not found: ${path}`, type: 'not_found' } });
  }

  private async handleModels(_req: IncomingMessage, res: http.ServerResponse): Promise<void> {
    const allPlugins = this.registry.listPlugins();
    if (allPlugins.length === 0) {
      this.jsonResponse(res, 503, {
        error: { message: 'No plugins configured', type: 'configuration_error' },
      });
      return;
    }

    try {
      const models: { id: string; object: string; created: number; owned_by: string }[] = [];
      const now = Math.floor(Date.now() / 1000);
      for (const plugin of allPlugins) {
        const config = this.config.plugins[plugin.name] ?? {};
        const pluginModels = await plugin.listModels(config);
        for (const m of pluginModels) {
          models.push({
            id: `${plugin.name}/${m.id}`,
            object: 'model',
            created: now,
            owned_by: plugin.name,
          });
        }
      }
      this.jsonResponse(res, 200, {
        object: 'list',
        data: models,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.jsonResponse(res, 502, { error: { message: msg, type: 'provider_error' } });
    }
  }

  private resolvePlugin(model: string): { plugin: BridgePlugin | null; error: string | null } {
    const slashIndex = model.indexOf('/');
    if (slashIndex !== -1) {
      const prefix = model.slice(0, slashIndex);
      const plugin = this.registry.getPlugin(prefix);
      if (plugin) return { plugin, error: null };
      return { plugin: null, error: `Unknown plugin: "${prefix}"` };
    }
    return { plugin: this.registry.getDefaultPlugin(), error: null };
  }

  private async handleChatCompletions(
    req: IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const parsed = await parseChatRequest(req);
    if (!parsed.success) {
      this.jsonResponse(res, 400, {
        error: { message: parsed.error, type: 'invalid_request_error' },
      });
      return;
    }

    const { messages, model, stream, tools } = parsed.data;
    const { plugin, error } = this.resolvePlugin(model);

    if (error) {
      this.jsonResponse(res, 400, {
        error: { message: error, type: 'invalid_request_error' },
      });
      return;
    }

    if (!plugin) {
      this.jsonResponse(res, 503, {
        error: { message: 'No default plugin configured', type: 'configuration_error' },
      });
      return;
    }

    try {
      const config = this.config.plugins[plugin.name] ?? {};
      const modelId = model.includes('/') ? model.slice(model.indexOf('/') + 1) : model;
      const session = await plugin.createSession(config, modelId);
      const sessionId = req.headers['x-session-id'] as string | undefined;
      this.sessions.set(sessionId ?? crypto.randomUUID(), session);

      res.writeHead(200, {
        'Content-Type': stream ? 'text/event-stream; charset=utf-8' : 'application/json',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      const completionId = `chatcmpl-${crypto.randomUUID()}`;
      const chunks: string[] = [];
      const toolCalls: { id: string; name: string; arguments: string }[] = [];
      let finishReason: string | undefined;

      if (stream) {
        const rolePayload = {
          id: completionId,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
        };
        res.write(`data: ${JSON.stringify(rolePayload)}\n\n`);
      }

      for await (const chunk of session.send(messages, tools)) {
        if (stream) {
          res.write(formatStreamChunk(chunk, model, completionId));
        } else {
          if (chunk.type === 'text' && chunk.content) {
            chunks.push(chunk.content);
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            toolCalls.push(chunk.toolCall);
          } else if (chunk.type === 'done' && chunk.finishReason) {
            finishReason = chunk.finishReason;
          }
        }
      }

      if (!stream) {
        const completion = formatCompletion(
          chunks.join(''),
          model,
          completionId,
          toolCalls.length > 0 ? toolCalls : undefined,
          finishReason,
        );
        res.end(JSON.stringify(completion));
      } else {
        res.write(`data: [DONE]\n\n`);
        res.end();
      }

      await session.dispose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (stream && !res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ error: { message: msg, type: 'provider_error' } })}\n\n`,
        );
        res.end();
      } else if (!res.headersSent) {
        this.jsonResponse(res, 502, { error: { message: msg, type: 'provider_error' } });
      }
    }
  }

  private jsonResponse(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  registerPlugin(plugin: BridgePlugin): void {
    this.registry.register(plugin);
  }

  setActivePlugin(name: string): void {
    this.registry.setActive(name);
  }

  setDefaultPlugin(name: string): void {
    this.registry.setDefault(name);
  }
}
