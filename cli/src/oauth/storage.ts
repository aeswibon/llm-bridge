import type { TokenStore } from './types.js';
import { createFileStore } from './storage-file.js';

export function createTokenStore(): TokenStore {
  return createFileStore();
}
