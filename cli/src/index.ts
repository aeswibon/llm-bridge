#!/usr/bin/env node
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { configureOpencodeCommand } from './commands/configure.js';
import { doctorCommand } from './commands/doctor.js';
import {
  daemonStatusCommand,
  daemonDownloadCommand,
  daemonLocateCommand,
  daemonReloadCommand,
} from './commands/daemon.js';
import { installDaemonCommand, uninstallDaemonCommand } from './commands/daemon.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';

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
        case 'reload':
          await daemonReloadCommand();
          break;
        default:
          console.log('Usage: llm-bridge daemon [status|download|locate|reload]');
      }
      break;
    }
    case 'login': {
      const provider = process.argv[3];
      await loginCommand(provider);
      break;
    }
    case 'logout': {
      const provider = process.argv[3];
      await logoutCommand(provider);
      break;
    }
    case 'help':
    default:
      console.log(`llm-bridge v1.0.0

Usage:
  llm-bridge init              Interactive setup wizard (configure one or more providers)
  llm-bridge start             Launch bridge server (all configured plugins registered)
  llm-bridge login [provider]  OAuth login (copilot, cursor)
  llm-bridge logout [provider] Remove stored OAuth token
  llm-bridge configure         Inject OpenCode config for the default provider
  llm-bridge doctor            Run diagnostics
  llm-bridge install-daemon    Install platform daemon (LaunchAgent or systemd)
  llm-bridge uninstall-daemon  Remove platform daemon
  llm-bridge daemon [status|download|locate|reload]  Manage Windsurf daemon binary
  llm-bridge help              Show this help`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
