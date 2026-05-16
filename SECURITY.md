# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 2.x.x   | ✅         |

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability:

1. **Do not** open a public issue
2. Email us at **security@llm-bridge.dev** (or open a [GitHub Security Advisory](https://github.com/anomalyco/llm-bridge/security/advisories/new))
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and aim to release a patch within 7 days.

## Security Best Practices

- **API keys** are stored in `~/.config/llm-bridge/config.json` — restrict file permissions: `chmod 600`
- **Never commit** your config file or `.env` files
- The bridge binds to `127.0.0.1` by default — do not expose it to the network without authentication
- Use `llm-bridge doctor` to check your configuration
