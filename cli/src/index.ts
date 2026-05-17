#!/usr/bin/env node
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { configureOpencodeCommand } from './commands/configure.js';
import { doctorCommand } from './commands/doctor.js';
import { daemonStatusCommand, daemonDownloadCommand, daemonLocateCommand } from './commands/daemon.js';
import { installDaemonCommand, uninstallDaemonCommand } from './commands/daemon.js';

const command = process.argv[2] ?? 'help';

async function main(): Promise<void> {
  switch (command) {
    case 'init':
      await initCommand();
      break;
    case 'start':
      await startCommand();
      break;
    case 'configure':
      await configureOpencodeCommand();
      break;
    case 'doctor':
      await doctorCommand();
      break;
    case 'install-daemon':
      await installDaemonCommand();
      break;
    case 'uninstall-daemon':
      await uninstallDaemonCommand();
      break;
    case 'daemon': {
      const subcommand = process.argv[3] ?? 'status';
      switch (subcommand) {
        case 'status':
          await daemonStatusCommand();
          break;
        case 'download':
          await daemonDownloadCommand();
          break;
        case 'locate':
          await daemonLocateCommand();
          break;
        default:
          console.log('Usage: llm-bridge daemon [status|download|locate]');
      }
      break;
    }
    case 'help':
    default:
      console.log(`llm-bridge v2.0.0

Usage:
  llm-bridge init              Setup wizard
  llm-bridge start             Launch bridge server
  llm-bridge configure         Inject OpenCode config
  llm-bridge doctor            Run diagnostics
  llm-bridge install-daemon    Install macOS LaunchAgent
  llm-bridge uninstall-daemon  Remove macOS LaunchAgent
  llm-bridge daemon [status|download|locate]  Manage daemon binary
  llm-bridge help              Show this help`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
