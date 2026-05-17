# Troubleshooting

## Bridge won't start

**Port already in use**

```
[llm-bridge] error: port 3849 is already in use
```

Run `llm-bridge doctor` to confirm. Change port in `~/.config/llm-bridge/config.json` or kill the process using the port:

```bash
lsof -i :3849 -t | xargs kill
```

**No active plugin configured**

```
No active plugin configured
```

Run `llm-bridge init` to set up a provider.

**Unknown plugin**

```
[llm-bridge] warning: unknown plugin "xyz"
```

- Check `activePlugin` in `~/.config/llm-bridge/config.json`
- Valid values: `cursor`, `copilot`, `windsurf`

## Windsurf daemon issues

**Language server not found**

```
Windsurf language server not found.
Run: llm-bridge daemon download
```

- Ensure Windsurf IDE is installed (macOS: `/Applications/Windsurf.app`)
- Set custom path: `export WINDSURF_LANGUAGE_SERVER_PATH=/path/to/language_server`
- Download managed daemon: `llm-bridge daemon download`

**Daemon download fails**

```
Download failed: ...
```

- Check internet connection
- The download URL may have changed — check Windsurf changelog
- Manually download and place at `~/.llm-bridge/daemons/language_server`

**Checksum mismatch**

```
Checksum mismatch: expected ..., got ...
```

- The downloaded binary may be corrupted
- Delete and re-download: `rm ~/.llm-bridge/daemons/language_server && llm-bridge daemon download`

**Daemon crashes on startup**

- Check if Windsurf IDE is up to date
- Run `llm-bridge daemon locate` to verify the binary path
- Check stderr output in `~/Library/Logs/llm-bridge.log`

## Copilot issues

**Authentication failed**

```
[llm-bridge] error: authentication failed for copilot
```

- Ensure your GitHub account has an active Copilot subscription
- Verify your GitHub token has the correct scopes
- Try re-authenticating: `llm-bridge init` and select copilot

**Token expired**

Copilot tokens may expire. Re-run `llm-bridge init` to refresh.

**Model not available**

- Run `GET http://127.0.0.1:3849/v1/models` to see available models
- Copilot model availability depends on your subscription tier

## OAuth issues

**Device flow timeout**

```
OAuth device flow timed out. Please try again.
```

- The device flow requires you to authorize in a browser
- Complete the authorization within the timeout period (usually 5 minutes)
- Check your internet connection

**OAuth token refresh failed**

- The refresh token may have expired — re-run `llm-bridge init`
- Check that the OAuth provider's API is accessible

**Missing OAuth client ID**

The OAuth client IDs in `@llm-bridge/oauth` are placeholders. For production use, register your own OAuth application with the provider and update the client ID/secret.

## Cursor API errors

**Invalid API key**

```
Invalid API key. Please check and try again.
```

- Get a fresh key from https://cursor.com/dashboard/cloud-agents
- Ensure no extra whitespace in config file

**Agent run failed**

```
Agent run error: ...
```

- Check your Cursor subscription is active
- Verify the model ID is valid (run `GET /v1/models` to list available models)
- Check `~/Library/Logs/cursor-opencode-bridge.log` for detailed logs

## OpenCode can't connect

**Connection refused**

- Ensure the bridge is running: `llm-bridge start`
- Check the baseURL in `opencode.json` matches your bridge port (default 3849)
- The `apiKey` in OpenCode config is a placeholder — real auth is on the bridge process

**Model not found**

- Add the model to your `opencode.json` under `provider.llm-bridge.models`
- Run `GET http://127.0.0.1:3849/v1/models` to see available model IDs

## macOS LaunchAgent issues

**Daemon won't start**

- Check logs: `tail -f ~/Library/Logs/llm-bridge.log`
- Ensure `CURSOR_API_KEY` is set in `~/.config/llm-bridge/config.json`
- Reinstall: `llm-bridge uninstall-daemon && llm-bridge install-daemon`

**Logs are empty**

- The daemon may have failed to bootstrap. Check Console.app for `com.llm-bridge.daemon`

## Diagnostics

Run `llm-bridge doctor` for a full diagnostic check:

- Config file existence
- Plugin configuration
- Bridge server connectivity
- Port availability
- Daemon binary existence (Windsurf)
- OAuth token validity
