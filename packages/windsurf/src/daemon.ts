import { createDaemonManager, type DaemonManager } from '@ai-ide-bridge/core';
import { homedir, platform, arch } from 'node:os';
import { join } from 'node:path';

const DEFAULT_KNOWN_PATHS: string[] = [
  join('/Applications', 'Windsurf.app', 'Contents', 'Resources', 'language_server'),
  join('/usr', 'local', 'bin', 'language_server'),
];

interface WindsurfDaemonOptions {
  knownPaths?: string[];
}

export function createWindsurfDaemon(options: WindsurfDaemonOptions = {}): DaemonManager {
  const knownPaths = options.knownPaths ?? DEFAULT_KNOWN_PATHS;

  return createDaemonManager({
    binaryName: 'language_server',
    downloadUrl: `https://server.codeium.com/language_server/latest/{platform}/{arch}`,
    checksum: 'PLACEHOLDER_SHA256',
    knownPaths,
    envVar: 'WINDSURF_LANGUAGE_SERVER_PATH',
  });
}
