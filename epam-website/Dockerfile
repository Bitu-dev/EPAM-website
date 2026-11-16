# syntax=docker/dockerfile:1.7
# One image for the whole site: SSR frontend + API. The server is a single self-contained Node bundle.

# ---- dependencies (cached until the lockfile changes) ----
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY . .
# NITRO_PRESET=node-server -> .output/server/index.mjs (self-contained: no node_modules needed at runtime)
ENV NITRO_PRESET=node-server NODE_ENV=production
RUN bun run build

# ---- ops tools: user CLI and tests, run on demand (not part of the runtime image) ----
#   docker compose --profile tools run --rm tools bun scripts/user.ts list
FROM build AS tools
ENV NODE_ENV=development
CMD ["bun", "scripts/user.ts", "list"]

# ---- runtime ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
# Non-root, read-only-friendly: the app only writes to the database and stdout.
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app -H -s /sbin/nologin app
COPY --from=build --chown=root:root /app/.output ./.output
USER 10001:10001
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
# `node` as PID 1 exits on SIGTERM; compose/orchestrators restart it cleanly.
CMD ["node", ".output/server/index.mjs"]
