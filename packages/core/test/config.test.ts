import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadConfig, saveConfig, configPath } from "../src/config.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("config", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "llm-bridge-config-"));
    vi.spyOn(os, "homedir").mockReturnValue(tmpDir);
  });

  it("returns default config when no file exists", () => {
    const config = loadConfig();
    expect(config.activePlugin).toBe("cursor");
    expect(config.port).toBe(3849);
  });

  it("loads config from file", () => {
    const configDir = path.join(tmpDir, ".config", "llm-bridge");
    fs.mkdirSync(configDir, { recursive: true });
    const configData = { activePlugin: "cursor", port: 9999, plugins: {}, host: "127.0.0.1", sessionTTL: 1800, toolMode: "lenient" as const };
    fs.writeFileSync(configPath(), JSON.stringify(configData));
    const config = loadConfig();
    expect(config.port).toBe(9999);
  });

  it("saves config to file", () => {
    const config = loadConfig();
    config.port = 5555;
    saveConfig(config);
    const loaded = loadConfig();
    expect(loaded.port).toBe(5555);
  });

  it("overrides port from LLM_BRIDGE_PORT env", () => {
    process.env.LLM_BRIDGE_PORT = "7777";
    const config = loadConfig();
    expect(config.port).toBe(7777);
    delete process.env.LLM_BRIDGE_PORT;
  });

  it("overrides host from LLM_BRIDGE_HOST env", () => {
    process.env.LLM_BRIDGE_HOST = "0.0.0.0";
    const config = loadConfig();
    expect(config.host).toBe("0.0.0.0");
    delete process.env.LLM_BRIDGE_HOST;
  });
});
