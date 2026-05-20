import { DaemonBridgeSession } from '../../core/index.js';
import type { DaemonManager } from '../../core/index.js';

export class WindsurfBridgeSession extends DaemonBridgeSession {
  constructor(daemon: DaemonManager, token: string, model: string, cwd: string = process.cwd()) {
    super(daemon, token, model, cwd);
  }
}
