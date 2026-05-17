import { spawn, type ChildProcess } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, platform, arch } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { IncomingMessage, get as httpGet, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';

export interface DaemonManager {
  binaryName: string;
  locate(): Promise<string | null>;
  download(): Promise<string>;
  spawn(binaryPath: string, args: string[]): ChildProcess;
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

      const MAX_REDIRECTS = 5;

      const followRedirect = (
        currentUrl: string,
        redirectCount: number,
      ): Promise<Buffer> =>
        new Promise((resolve, reject) => {
          const parsed = new URL(currentUrl);
          const requestFn = parsed.protocol === 'https:' ? httpsRequest : httpRequest;

          const req = requestFn(currentUrl, (res: IncomingMessage) => {
            if (
              res.statusCode === 301 ||
              res.statusCode === 302 ||
              res.statusCode === 307 ||
              res.statusCode === 308
            ) {
              if (redirectCount >= MAX_REDIRECTS) {
                reject(new Error('Too many redirects'));
                return;
              }
              const location = res.headers.location;
              if (location) {
                const resolved = new URL(location, currentUrl).href;
                res.resume();
                followRedirect(resolved, redirectCount + 1)
                  .then(resolve)
                  .catch(reject);
              } else {
                reject(new Error('Redirect with no location'));
              }
              return;
            }

            if (res.statusCode !== 200) {
              reject(new Error(`Download failed: ${res.statusCode}`));
              return;
            }

            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
              resolve(Buffer.concat(chunks));
            });
          });

          req.on('error', reject);
          req.end();
        });

      const downloadPromise = followRedirect(url, 0);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Download timeout (30s)')), 30000);
      });

      return Promise.race([downloadPromise, timeoutPromise]).then((data) => {
        writeFileSync(destPath, data);
        chmodSync(destPath, 0o755);
        const hash = createHash('sha256').update(data).digest('hex');
        if (hash !== config.checksum) {
          unlinkSync(destPath);
          throw new Error(
            `Checksum mismatch: expected ${config.checksum}, got ${hash}`,
          );
        }
        return destPath;
      });
    },

    spawn(binaryPath: string, args: string[]): ChildProcess {
      return spawn(binaryPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    },

    async healthCheck(port?: number): Promise<boolean> {
      const path = await this.locate();
      if (!path) return false;
      if (!existsSync(path)) return false;

      if (port) {
        try {
          return new Promise((resolve) => {
            const req = httpGet(`http://127.0.0.1:${port}/health`, (res) => {
              resolve(res.statusCode === 200);
            });
            req.on('error', () => resolve(false));
            req.setTimeout(5000, () => {
              req.destroy();
              resolve(false);
            });
          });
        } catch {
          return false;
        }
      }

      return true;
    },
  };
}
