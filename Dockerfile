FROM node:20-alpine AS builder

RUN apk add --no-cache pnpm

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/cursor/package.json packages/cursor/
COPY packages/mcp/package.json packages/mcp/
COPY cli/package.json cli/

RUN pnpm install --frozen-lockfile

COPY packages/core/src packages/core/src
COPY packages/cursor/src packages/cursor/src
COPY packages/mcp/src packages/mcp/src
COPY cli/src cli/src

RUN pnpm build

FROM node:20-alpine

RUN apk add --no-cache tini

WORKDIR /app

COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/cursor/dist packages/cursor/dist
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
