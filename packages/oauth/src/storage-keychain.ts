import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import type { StoredToken, TokenStore } from './types.js';

const SERVICE_NAME = 'llm-bridge';

function isKeychainAvailable(): boolean {
  const os = platform();
  if (os === 'darwin') {
    try {
      execSync('which security', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  if (os === 'linux') {
    try {
      execSync('which secret-tool', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  if (os === 'win32') {
    try {
      execSync('powershell -Command "Get-Module -ListAvailable"', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function accountKey(provider: string): string {
  return `${SERVICE_NAME}:${provider}`;
}

export function createKeychainStore(): TokenStore | null {
  if (!isKeychainAvailable()) return null;

  const os = platform();

  return {
    async set(provider: string, token: StoredToken): Promise<void> {
      const account = accountKey(provider);
      const secret = JSON.stringify(token);

      if (os === 'darwin') {
        // Use printf to avoid shell injection from special characters in the secret
        const escaped = secret
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\$/g, '\\$')
          .replace(/`/g, '\\`');
        execSync(
          `security add-generic-password -s "${SERVICE_NAME}" -a "${account}" -w "${escaped}" -U`,
          {
            stdio: 'ignore',
          },
        );
      } else if (os === 'linux') {
        const input = Buffer.from(secret);
        execSync(
          `secret-tool store --label="${SERVICE_NAME}" service "${SERVICE_NAME}" account "${account}"`,
          {
            input,
            stdio: ['pipe', 'ignore', 'ignore'],
          },
        );
      } else if (os === 'win32') {
        execSync(
          `powershell -Command "$s=Get-Content -Raw; cmdkey /generic:${account} /user:token /pass:$s"`,
          {
            input: secret,
            stdio: ['pipe', 'ignore', 'ignore'],
          },
        );
      }
    },

    async get(provider: string): Promise<StoredToken | null> {
      const account = accountKey(provider);

      try {
        if (os === 'darwin') {
          const output = execSync(
            `security find-generic-password -s "${SERVICE_NAME}" -a "${account}" -w 2>/dev/null`,
            {
              stdio: ['ignore', 'pipe', 'ignore'],
            },
          )
            .toString()
            .trim();
          if (!output) return null;
          return JSON.parse(output) as StoredToken;
        } else if (os === 'linux') {
          const output = execSync(
            `secret-tool lookup service "${SERVICE_NAME}" account "${account}"`,
            {
              stdio: ['ignore', 'pipe', 'ignore'],
            },
          ).toString();
          return JSON.parse(output) as StoredToken;
        } else if (os === 'win32') {
          // Windows Credential Manager requires PasswordVault API which has
          // different semantics. Fall back to encrypted file store.
          return null;
        }
      } catch (err) {
        console.error(`Keychain get failed for ${provider}:`, err);
        return null;
      }
      return null;
    },

    async delete(provider: string): Promise<void> {
      const account = accountKey(provider);

      try {
        if (os === 'darwin') {
          execSync(`security delete-generic-password -s "${SERVICE_NAME}" -a "${account}"`, {
            stdio: 'ignore',
          });
        } else if (os === 'linux') {
          execSync(`secret-tool clear service "${SERVICE_NAME}" account "${account}"`, {
            stdio: 'ignore',
          });
        } else if (os === 'win32') {
          execSync(`powershell -Command "cmdkey /delete:${account}"`, {
            stdio: 'ignore',
          });
        }
      } catch (err) {
        console.error(`Keychain delete failed for ${provider}:`, err);
      }
    },
  };
}
