import { DaemonBridgeSession } from '@ai-ide-bridge/core';
import type { DaemonManager } from '@ai-ide-bridge/core';

export class WindsurfBridgeSession extends DaemonBridgeSession {
  constructor(daemon: DaemonManager, token: string, model: string, cwd: string = process.cwd()) {
    super(daemon, token, model, cwd);
  }
}
