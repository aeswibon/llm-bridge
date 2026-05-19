import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { getPlatform } from '../utils/platform.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LABEL = 'com.llm-bridge.daemon';

export async function installDaemonCommand(): Promise<void> {
  const platform = getPlatform();
  if (platform === 'darwin') {
    await installMacOSDaemon();
  } else if (platform === 'linux') {
    await installLinuxDaemon();
  } else {
    console.error('Daemon installation is only supported on macOS and Linux.');
    process.exit(1);
  }
}

async function installMacOSDaemon(): Promise<void> {
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
  const wrapperPath = path.join(__dirname, '..', '..', 'scripts', 'llm-bridge-daemon.sh');

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${wrapperPath}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>30</integer>
  <key>StandardOutPath</key>
  <string>${os.homedir()}/Library/Logs/llm-bridge.log</string>
  <key>StandardErrorPath</key>
  <string>${os.homedir()}/Library/Logs/llm-bridge.err.log</string>
</dict>
</plist>`;

  try {
    fs.mkdirSync(path.dirname(plistPath), { recursive: true });
    fs.writeFileSync(plistPath, plist);
  } catch (e) {
    console.error('Failed to write plist file:', e);
    process.exit(1);
  }

  try {
    execSync(`launchctl bootstrap "gui/$(id -u)" "${plistPath}"`, { stdio: 'inherit' });
    console.log(`Installed LaunchAgent: ${plistPath}`);
    console.log(`Logs: ~/Library/Logs/llm-bridge.{log,err.log}`);
  } catch (e) {
    console.error('Failed to bootstrap daemon:', e);
    process.exit(1);
  }
}

async function installLinuxDaemon(): Promise<void> {
  const serviceDir = path.join(os.homedir(), '.config', 'systemd', 'user');
  const servicePath = path.join(serviceDir, 'llm-bridge.service');

  const nodePath = process.execPath;
  const cliPath = path.join(__dirname, '..', 'dist', 'index.js');

  const unit = `[Unit]
Description=llm-bridge daemon
After=network.target

[Service]
Type=simple
ExecStart=${nodePath} ${cliPath} start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
`;

  try {
    fs.mkdirSync(serviceDir, { recursive: true });
    fs.writeFileSync(servicePath, unit);
  } catch (e) {
    console.error('Failed to write service file:', e);
    process.exit(1);
  }

  try {
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
    execSync('systemctl --user enable --now llm-bridge', { stdio: 'inherit' });
    console.log(`Installed systemd user service: ${servicePath}`);
    console.log('Logs: journalctl --user -u llm-bridge -f');
  } catch (e) {
    console.error('Failed to enable systemd service:', e);
    process.exit(1);
  }
}

export async function uninstallDaemonCommand(): Promise<void> {
  const platform = getPlatform();
  if (platform === 'darwin') {
    await uninstallMacOSDaemon();
  } else if (platform === 'linux') {
    await uninstallLinuxDaemon();
  } else {
    console.error('Daemon uninstallation is only supported on macOS and Linux.');
    process.exit(1);
  }
}

async function uninstallMacOSDaemon(): Promise<void> {
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);

  try {
    execSync(`launchctl bootout "gui/$(id -u)" "${plistPath}" 2>/dev/null || true`, {
      stdio: 'inherit',
    });
  } catch {
    // Ignore errors during unbootstrap
  }

  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
    console.log(`Removed LaunchAgent: ${plistPath}`);
  } else {
    console.log('No LaunchAgent found.');
  }
}

async function uninstallLinuxDaemon(): Promise<void> {
  const servicePath = path.join(os.homedir(), '.config', 'systemd', 'user', 'llm-bridge.service');

  try {
    execSync('systemctl --user disable --now llm-bridge 2>/dev/null || true', {
      stdio: 'inherit',
    });
  } catch {
    // Ignore errors during disable
  }

  if (fs.existsSync(servicePath)) {
    fs.unlinkSync(servicePath);
    console.log(`Removed systemd service: ${servicePath}`);
  } else {
    console.log('No systemd service found.');
  }

  try {
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
  } catch {
    // Ignore errors during reload
  }
}

export async function daemonStatusCommand(): Promise<void> {
  const { createWindsurfDaemon } = await import('@ai-ide-bridge/windsurf/daemon.js');
  const daemon = createWindsurfDaemon();

  const path = await daemon.locate();
  if (path) {
    console.log(`Windsurf language server found at: ${path}`);
    const healthy = await daemon.healthCheck();
    console.log(`Health: ${healthy ? 'OK' : 'Unhealthy'}`);
  } else {
    console.log('Windsurf language server not found.');
    console.log('Run: llm-bridge daemon download');
  }
}

export async function daemonDownloadCommand(): Promise<void> {
  const { createWindsurfDaemon } = await import('@ai-ide-bridge/windsurf/daemon.js');
  const daemon = createWindsurfDaemon();

  console.log('Downloading Windsurf language server...');
  try {
    const path = await daemon.download();
    console.log(`Downloaded to: ${path}`);
  } catch (err: any) {
    console.error(`Download failed: ${err.message}`);
    process.exit(1);
  }
}

export async function daemonLocateCommand(): Promise<void> {
  const { createWindsurfDaemon } = await import('@ai-ide-bridge/windsurf/daemon.js');
  const daemon = createWindsurfDaemon();

  const path = await daemon.locate();
  if (path) {
    console.log(path);
  } else {
    console.log('Not found');
    process.exit(1);
  }
}

export async function daemonReloadCommand(): Promise<void> {
  if (getPlatform() !== 'linux') {
    console.error('Daemon reload is only supported on Linux.');
    process.exit(1);
  }

  try {
    execSync('systemctl --user reload-or-restart llm-bridge', { stdio: 'inherit' });
    console.log('Daemon reloaded.');
  } catch (e) {
    console.error('Failed to reload daemon:', e);
    process.exit(1);
  }
}
