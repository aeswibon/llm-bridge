import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

vi.mock('../src/utils/platform.js', () => ({
  getPlatform: vi.fn(() => process.platform),
}));

const { execSync } = await import('node:child_process');
const mockedExecSync = vi.mocked(execSync);
const { getPlatform } = await import('../src/utils/platform.js');
const mockedGetPlatform = vi.mocked(getPlatform);

describe('installDaemonCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPlatform.mockReturnValue(process.platform);
  });

  it('generates systemd unit file on Linux', async () => {
    mockedGetPlatform.mockReturnValue('linux');

    const { installDaemonCommand } = await import('../src/commands/daemon.js');

    await installDaemonCommand();

    const fs = await import('node:fs');
    const mockedFs = vi.mocked(fs.default);

    expect(mockedFs.mkdirSync).toHaveBeenCalled();
    const writeCall = mockedFs.writeFileSync.mock.calls[0];
    const unitPath = writeCall[0] as string;
    expect(unitPath).toContain('.config/systemd/user/llm-bridge.service');

    const unitContent = writeCall[1] as string;
    expect(unitContent).toContain('[Unit]');
    expect(unitContent).toContain('Description=llm-bridge daemon');
    expect(unitContent).toContain('After=network.target');
    expect(unitContent).toContain('[Service]');
    expect(unitContent).toContain('Type=simple');
    expect(unitContent).toContain('Restart=on-failure');
    expect(unitContent).toContain('RestartSec=5');
    expect(unitContent).toContain('[Install]');
    expect(unitContent).toContain('WantedBy=default.target');

    expect(mockedExecSync).toHaveBeenCalledWith(
      'systemctl --user daemon-reload',
      { stdio: 'inherit' },
    );
    expect(mockedExecSync).toHaveBeenCalledWith(
      'systemctl --user enable --now llm-bridge',
      { stdio: 'inherit' },
    );
  });

  it('routes to installMacOSDaemon on darwin', async () => {
    mockedGetPlatform.mockReturnValue('darwin');

    const { installDaemonCommand } = await import('../src/commands/daemon.js');
    const fs = await import('node:fs');
    const mockedFs = vi.mocked(fs.default);

    await installDaemonCommand();

    expect(mockedFs.writeFileSync).toHaveBeenCalled();
    const writeCall = mockedFs.writeFileSync.mock.calls[0];
    const plistPath = writeCall[0] as string;
    expect(plistPath).toContain('Library/LaunchAgents/com.llm-bridge.daemon.plist');

    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringContaining('launchctl bootstrap'),
      { stdio: 'inherit' },
    );
  });

  it('exits with error on unsupported platforms', async () => {
    mockedGetPlatform.mockReturnValue('win32');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { installDaemonCommand } = await import('../src/commands/daemon.js');

    await installDaemonCommand();

    expect(errorSpy).toHaveBeenCalledWith(
      'Daemon installation is only supported on macOS and Linux.',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('uninstallDaemonCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPlatform.mockReturnValue(process.platform);
  });

  it('removes systemd unit file on Linux', async () => {
    mockedGetPlatform.mockReturnValue('linux');

    const { uninstallDaemonCommand } = await import('../src/commands/daemon.js');
    const fs = await import('node:fs');
    const mockedFs = vi.mocked(fs.default);

    mockedFs.existsSync.mockReturnValue(true);

    await uninstallDaemonCommand();

    expect(mockedExecSync).toHaveBeenCalledWith(
      'systemctl --user disable --now llm-bridge 2>/dev/null || true',
      { stdio: 'inherit' },
    );

    const unlinkCall = mockedFs.unlinkSync.mock.calls[0];
    expect(unlinkCall[0]).toContain('.config/systemd/user/llm-bridge.service');

    expect(mockedExecSync).toHaveBeenCalledWith(
      'systemctl --user daemon-reload',
      { stdio: 'inherit' },
    );
  });

  it('routes to uninstallMacOSDaemon on darwin', async () => {
    mockedGetPlatform.mockReturnValue('darwin');

    const { uninstallDaemonCommand } = await import('../src/commands/daemon.js');
    const fs = await import('node:fs');
    const mockedFs = vi.mocked(fs.default);

    mockedFs.existsSync.mockReturnValue(true);

    await uninstallDaemonCommand();

    const unlinkCall = mockedFs.unlinkSync.mock.calls[0];
    expect(unlinkCall[0]).toContain('Library/LaunchAgents/com.llm-bridge.daemon.plist');

    expect(mockedExecSync).toHaveBeenCalledWith(
      expect.stringContaining('launchctl bootout'),
      { stdio: 'inherit' },
    );
  });

  it('errors on unsupported platforms', async () => {
    mockedGetPlatform.mockReturnValue('win32');

    const { uninstallDaemonCommand } = await import('../src/commands/daemon.js');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await uninstallDaemonCommand();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Daemon uninstallation is only supported on macOS and Linux.',
    );

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('handles missing service file gracefully on Linux', async () => {
    mockedGetPlatform.mockReturnValue('linux');

    const { uninstallDaemonCommand } = await import('../src/commands/daemon.js');
    const fs = await import('node:fs');
    const mockedFs = vi.mocked(fs.default);

    mockedFs.existsSync.mockReturnValue(false);

    await uninstallDaemonCommand();

    expect(mockedFs.unlinkSync).not.toHaveBeenCalled();
    expect(mockedExecSync).toHaveBeenCalledWith(
      'systemctl --user daemon-reload',
      { stdio: 'inherit' },
    );
  });
});

describe('daemonReloadCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPlatform.mockReturnValue(process.platform);
  });

  it('runs systemctl daemon-reload on Linux', async () => {
    mockedGetPlatform.mockReturnValue('linux');

    const { daemonReloadCommand } = await import('../src/commands/daemon.js');

    await daemonReloadCommand();

    expect(mockedExecSync).toHaveBeenCalledWith(
      'systemctl --user reload-or-restart llm-bridge',
      { stdio: 'inherit' },
    );
  });

  it('errors on unsupported platforms', async () => {
    mockedGetPlatform.mockReturnValue('win32');

    const { daemonReloadCommand } = await import('../src/commands/daemon.js');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await daemonReloadCommand();

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(consoleSpy).toHaveBeenCalledWith('Daemon reload is only supported on Linux.');

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
