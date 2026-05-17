import { DaemonBridgeSession } from '@llm-bridge/core';
import type { DaemonManager } from '@llm-bridge/core';

export class WindsurfBridgeSession extends DaemonBridgeSession {
  constructor(daemon: DaemonManager, token: string, model: string, cwd: string = process.cwd()) {
    super(daemon, token, model, cwd);
  }
}
