import { DaemonBridgeSession } from '@llm-bridge/core';
import type { DaemonManager } from '@llm-bridge/core';
import { translateTools } from './tools.js';

export class WindsurfBridgeSession extends DaemonBridgeSession {
  constructor(
    daemon: DaemonManager,
    token: string,
    model: string,
    cwd: string = process.cwd(),
  ) {
    super(daemon, token, model, cwd);
  }
}
