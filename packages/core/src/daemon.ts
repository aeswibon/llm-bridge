import { spawn, type ChildProcess } from 'node:child_process';
import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
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
        if (existsSync(envPath)) {
          try {
            accessSync(envPath, constants.X_OK);
            return envPath;
          } catch {
            // Not executable, skip
          }
        }
      }

      // 2. Check knownPaths
      for (const p of config.knownPaths) {
        if (existsSync(p)) {
          try {
            accessSync(p, constants.X_OK);
            return p;
          } catch {
            // Not executable, skip
          }
        }
      }

      // 3. Check ~/.llm-bridge/daemons/
      const daemonsDir = getDaemonsDir();
      const managedPath = join(daemonsDir, config.binaryName);
      if (existsSync(managedPath)) {
        try {
          accessSync(managedPath, constants.X_OK);
          return managedPath;
        } catch {
          // Not executable, skip
        }
      }

      return null;
    },

    async download(): Promise<string> {
      const daemonsDir = getDaemonsDir();
      mkdirSync(daemonsDir, { recursive: true });
      const destPath = join(daemonsDir, config.binaryName);

      const url = config.downloadUrl.replace('{platform}', platform()).replace('{arch}', arch());

      const MAX_REDIRECTS = 5;
      const MAX_DOWNLOAD_SIZE = 500 * 1024 * 1024; // 500MB
      let currentReq: ReturnType<typeof httpRequest> | null = null;

      const followRedirect = (currentUrl: string, redirectCount: number): Promise<Buffer> =>
        new Promise((resolve, reject) => {
          const parsed = new URL(currentUrl);
          const requestFn = parsed.protocol === 'https:' ? httpsRequest : httpRequest;

          currentReq = requestFn(currentUrl, (res: IncomingMessage) => {
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
                const redirectUrl = new URL(location, currentUrl);
                if (redirectUrl.protocol !== 'http:' && redirectUrl.protocol !== 'https:') {
                  reject(new Error(`Redirect to unsupported protocol: ${redirectUrl.protocol}`));
                  res.resume();
                  return;
                }
                res.resume();
                followRedirect(redirectUrl.href, redirectCount + 1)
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
            let totalSize = 0;
            res.on('data', (chunk: Buffer) => {
              totalSize += chunk.length;
              if (totalSize > MAX_DOWNLOAD_SIZE) {
                reject(new Error(`Download exceeds maximum size (${MAX_DOWNLOAD_SIZE} bytes)`));
                res.destroy();
                return;
              }
              chunks.push(chunk);
            });
            res.on('end', () => {
              resolve(Buffer.concat(chunks));
            });
          });

          currentReq.on('error', reject);
          currentReq.end();
        });

      const downloadPromise = followRedirect(url, 0);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          currentReq?.destroy();
          reject(new Error('Download timeout (30s)'));
        }, 30000);
      });

      return Promise.race([downloadPromise, timeoutPromise]).then((data) => {
        try {
          writeFileSync(destPath, data);
          const hash = createHash('sha256').update(data).digest('hex');
          if (hash !== config.checksum) {
            throw new Error(`Checksum mismatch: expected ${config.checksum}, got ${hash}`);
          }
          chmodSync(destPath, 0o755);
          return destPath;
        } catch (err) {
          try {
            unlinkSync(destPath);
          } catch {}
          throw err;
        }
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
