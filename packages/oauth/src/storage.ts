import type { TokenStore } from './types.js';
import { createKeychainStore } from './storage-keychain.js';
import { createFileStore } from './storage-file.js';

export function createTokenStore(): TokenStore {
  const keychain = createKeychainStore();
  if (keychain) return keychain;
  return createFileStore();
}
