import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const LABEL = "com.llm-bridge.daemon";

export async function installDaemonCommand(): Promise<void> {
  if (process.platform !== "darwin") {
    console.error("Daemon installation is only supported on macOS.");
    process.exit(1);
  }

  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
  const wrapperPath = path.join(__dirname, "..", "..", "scripts", "llm-bridge-daemon.sh");

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

  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(plistPath, plist);

  try {
    execSync(`launchctl bootstrap "gui/$(id -u)" "${plistPath}"`, { stdio: "inherit" });
    console.log(`Installed LaunchAgent: ${plistPath}`);
    console.log(`Logs: ~/Library/Logs/llm-bridge.{log,err.log}`);
  } catch (e) {
    console.error("Failed to bootstrap daemon:", e);
    process.exit(1);
  }
}

export async function uninstallDaemonCommand(): Promise<void> {
  if (process.platform !== "darwin") {
    console.error("Daemon uninstallation is only supported on macOS.");
    process.exit(1);
  }

  const plistPath = path.join(os.homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);

  try {
    execSync(`launchctl bootout "gui/$(id -u)" "${plistPath}" 2>/dev/null || true`, { stdio: "inherit" });
  } catch {
    // Ignore errors during unbootstrap
  }

  if (fs.existsSync(plistPath)) {
    fs.unlinkSync(plistPath);
    console.log(`Removed LaunchAgent: ${plistPath}`);
  } else {
    console.log("No LaunchAgent found.");
  }
}
