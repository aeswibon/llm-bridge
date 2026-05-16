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
