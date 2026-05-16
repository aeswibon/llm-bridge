#!/usr/bin/env bash
set -euo pipefail

BRIDGE_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/dist/index.js"

if ! command -v node &>/dev/null; then
  echo "llm-bridge: node is required." >&2
  exit 1
fi

exec node "$BRIDGE_BIN" start
