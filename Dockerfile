# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
RUN npm install -g pnpm@11.2.2
WORKDIR /app

# Manifests first so the dependency layer is cached until they change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY react/package.json react/
COPY server/package.json server/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile

COPY react/ react/
COPY server/ server/
COPY web/ web/
COPY docs/ docs/
RUN pnpm build

# Self-contained server bundle with production dependencies only.
RUN pnpm --filter slang-server deploy --prod --legacy /app/deploy \
  && rm -rf /app/deploy/src /app/deploy/test /app/deploy/scripts \
    /app/deploy/tsconfig.json /app/deploy/tsconfig.build.json \
    /app/deploy/vitest.config.ts /app/deploy/drizzle.config.ts \
    /app/deploy/.env /app/deploy/.env.*

FROM node:24-alpine
ENV NODE_ENV=production \
  PORT=5800 \
  WEB_DIST=/app/web/dist \
  ICONS_DIR=/app/data/icons
WORKDIR /app/server
COPY --from=build /app/deploy/ ./
COPY --from=build /app/web/dist /app/web/dist
# Writable by the runtime `node` user; mount a volume here to persist icons.
RUN mkdir -p /app/data/icons && chown node:node /app/data/icons
EXPOSE 5800
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/ > /dev/null || exit 1
CMD ["node", "dist/index.js"]
