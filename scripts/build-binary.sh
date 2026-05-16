#!/usr/bin/env bash
set -euo pipefail

echo "Building llm-bridge binary..."
pnpm build
npx pkg cli/dist/index.js --targets node18-macos-arm64,node18-macos-x64,node18-linux-x64 --output dist/llm-bridge
echo "Binaries built in dist/"
