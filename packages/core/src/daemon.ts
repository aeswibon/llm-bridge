import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir, platform, arch } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { IncomingMessage } from 'node:http';
import { get } from 'node:https';

export interface DaemonManager {
  binaryName: string;
  locate(): Promise<string | null>;
  download(): Promise<string>;
  spawn(args: string[]): ChildProcess;
  healthCheck(port?: number): Promise<boolean>;
}

export function createDaemonManager(config: {
  binaryName: string;
  downloadUrl: string;
  checksum: string;
  knownPaths: string[];
  envVar?: string;
  daemonsDir?: string;
}): DaemonManager {
  const defaultDaemonsDir = () => join(homedir(), '.llm-bridge', 'daemons');
  const getDaemonsDir = () => config.daemonsDir ?? defaultDaemonsDir();

  return {
    binaryName: config.binaryName,

    async locate(): Promise<string | null> {
      // 1. Check envVar
      if (config.envVar && process.env[config.envVar]) {
        const envPath = process.env[config.envVar]!;
        if (existsSync(envPath)) return envPath;
      }

      // 2. Check knownPaths
      for (const p of config.knownPaths) {
        if (existsSync(p)) return p;
      }

      // 3. Check ~/.llm-bridge/daemons/
      const daemonsDir = getDaemonsDir();
      const managedPath = join(daemonsDir, config.binaryName);
      if (existsSync(managedPath)) return managedPath;

      return null;
    },

    async download(): Promise<string> {
      const daemonsDir = getDaemonsDir();
      mkdirSync(daemonsDir, { recursive: true });
      const destPath = join(daemonsDir, config.binaryName);

      const url = config.downloadUrl
        .replace('{platform}', platform())
        .replace('{arch}', arch());

      return new Promise((resolve, reject) => {
        const req = get(url, (res: IncomingMessage) => {
          if (res.statusCode !== 200) {
            reject(new Error(`Download failed: ${res.statusCode}`));
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => {
            const data = Buffer.concat(chunks);
            writeFileSync(destPath, data);
            const hash = createHash('sha256').update(data).digest('hex');
            if (hash !== config.checksum) {
              reject(
                new Error(
                  `Checksum mismatch: expected ${config.checksum}, got ${hash}`,
                ),
              );
              return;
            }
            resolve(destPath);
          });
        });

        req.on('error', reject);
      });
    },

    spawn(args: string[]): ChildProcess {
      return spawn(config.binaryName, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    },

    async healthCheck(_port?: number): Promise<boolean> {
      const path = await this.locate();
      return path !== null && existsSync(path);
    },
  };
}
