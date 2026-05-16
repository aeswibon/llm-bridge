import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { hostname } from 'node:os';
import type { StoredToken, TokenStore } from './types.js';

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const machineId = [process.platform, hostname(), homedir()].join(':');
  return scryptSync(machineId, 'llm-bridge-oauth', KEY_LENGTH);
}

function getTokenFilePath(): string {
  const dir = join(homedir(), '.config', 'llm-bridge');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'tokens.enc');
}

function encrypt(data: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedData: string): string {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function createFileStore(): TokenStore {
  return {
    async set(provider: string, token: StoredToken): Promise<void> {
      const file = getTokenFilePath();
      const existing: Record<string, StoredToken> = existsSync(file)
        ? JSON.parse(decrypt(readFileSync(file, 'utf8')))
        : {};
      existing[provider] = token;
      writeFileSync(file, encrypt(JSON.stringify(existing)));
    },

    async get(provider: string): Promise<StoredToken | null> {
      const file = getTokenFilePath();
      if (!existsSync(file)) return null;
      try {
        const existing: Record<string, StoredToken> = JSON.parse(
          decrypt(readFileSync(file, 'utf8')),
        );
        return existing[provider] ?? null;
      } catch {
        return null;
      }
    },

    async delete(provider: string): Promise<void> {
      const file = getTokenFilePath();
      if (!existsSync(file)) return;
      try {
        const existing: Record<string, StoredToken> = JSON.parse(
          decrypt(readFileSync(file, 'utf8')),
        );
        delete existing[provider];
        writeFileSync(file, encrypt(JSON.stringify(existing)));
      } catch {
        // Ignore errors on delete
      }
    },
  };
}
