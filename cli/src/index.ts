#!/usr/bin/env node
import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";
import { configureOpencodeCommand } from "./commands/configure.js";
import { doctorCommand } from "./commands/doctor.js";
import { installDaemonCommand, uninstallDaemonCommand } from "./commands/daemon.js";

const command = process.argv[2] ?? "help";

async function main(): Promise<void> {
  switch (command) {
    case "init":
      await initCommand();
      break;
    case "start":
      await startCommand();
      break;
    case "configure":
      await configureOpencodeCommand();
      break;
    case "doctor":
      await doctorCommand();
      break;
    case "install-daemon":
      await installDaemonCommand();
      break;
    case "uninstall-daemon":
      await uninstallDaemonCommand();
      break;
    case "help":
    default:
      console.log(`llm-bridge v2.0.0

Usage:
  llm-bridge init              Setup wizard
  llm-bridge start             Launch bridge server
  llm-bridge configure         Inject OpenCode config
  llm-bridge doctor            Run diagnostics
  llm-bridge install-daemon    Install macOS LaunchAgent
  llm-bridge uninstall-daemon  Remove macOS LaunchAgent
  llm-bridge help              Show this help`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
