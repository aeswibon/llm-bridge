FROM node:20-alpine AS builder

RUN apk add --no-cache pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/core/tsconfig.json packages/core/
COPY packages/cursor/package.json packages/cursor/
COPY packages/cursor/tsconfig.json packages/cursor/
COPY packages/copilot/package.json packages/copilot/
COPY packages/copilot/tsconfig.json packages/copilot/
COPY packages/windsurf/package.json packages/windsurf/
COPY packages/windsurf/tsconfig.json packages/windsurf/
COPY packages/oauth/package.json packages/oauth/
COPY packages/oauth/tsconfig.json packages/oauth/
COPY packages/mcp/package.json packages/mcp/
COPY packages/mcp/tsconfig.json packages/mcp/
COPY cli/package.json cli/
COPY cli/tsconfig.json cli/

RUN pnpm install --frozen-lockfile

COPY packages/core/src packages/core/src
COPY packages/cursor/src packages/cursor/src
COPY packages/copilot/src packages/copilot/src
COPY packages/windsurf/src packages/windsurf/src
COPY packages/oauth/src packages/oauth/src
COPY packages/mcp/src packages/mcp/src
COPY cli/src cli/src

RUN pnpm build

FROM node:20-alpine

RUN apk add --no-cache tini

WORKDIR /app

COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/cursor/dist packages/cursor/dist
COPY --from=builder /app/packages/copilot/dist packages/copilot/dist
COPY --from=builder /app/packages/windsurf/dist packages/windsurf/dist
COPY --from=builder /app/packages/oauth/dist packages/oauth/dist
COPY --from=builder /app/packages/mcp/dist packages/mcp/dist
COPY --from=builder /app/cli/dist cli/dist
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/pnpm-workspace.yaml .

EXPOSE 3849

ENV LLM_BRIDGE_HOST=0.0.0.0
ENV LLM_BRIDGE_PORT=3849

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "cli/dist/index.js", "start"]
