# syntax=docker/dockerfile:1
# One image for the API and the room app it serves (docs/v9/ARCHITECTURE.md, Topology). The build context is the
# repository root: `docker build -f apps/api/Dockerfile .` (make v9-image).

# The Bun of package.json's packageManager; docs/development.md, Image, says how to move it.
ARG BUN_VERSION=1.4.4

FROM oven/bun:${BUN_VERSION}-alpine AS build
WORKDIR /app

# `bun install --frozen-lockfile` verifies the whole workspace graph against bun.lock, so every member's manifest is
# present even though only the room app and the API are installed. A new workspace member needs its line here.
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/arena/package.json apps/arena/package.json
COPY apps/room/package.json apps/room/package.json
COPY apps/site/package.json apps/site/package.json
COPY arena/package.json arena/package.json
COPY e2e/package.json e2e/package.json
COPY load/package.json load/package.json
COPY packages/i18n/package.json packages/i18n/package.json
COPY packages/room-client/package.json packages/room-client/package.json
COPY packages/room-core/package.json packages/room-core/package.json
COPY packages/table/package.json packages/table/package.json
COPY packages/telemetry/package.json packages/telemetry/package.json
COPY packages/test-kit/package.json packages/test-kit/package.json
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --ignore-scripts --filter '@fpp/room' --filter '@fpp/api'

COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
COPY apps/room apps/room

# The room app (Vite), then the API as one file with its dependencies. Identifiers are not minified: the names of
# spans come from function names (docs/v9/research/r05-elysia-bun-backend.md, section 9).
# Umami's two public build values for the room's shell (apps/room/vite.config.ts): no website id, no script tag.
ARG FPP_UMAMI_WEBSITE_ID=""
ARG FPP_UMAMI_DOMAINS=""
ENV NODE_ENV=production
RUN bun run --filter '@fpp/room' build \
 && bun run --filter '@fpp/api' build

# What the runtime image copies gets its modes here, with chmod, because a checkout's umask (0600 files, 0700 directories)
# would otherwise reach the image. `COPY --chmod` with a symbolic mode is not used: the daemon's own BuildKit (what
# `docker build` runs on a host, as the RollHook deploy does) left nested directories without the execute bit, so the
# runtime user could not open /app/drizzle/meta or /app/room/assets, while buildx did it right (make v9-image-perms).
RUN chmod -R u=rwX,go=rX apps/api/dist/main.js apps/api/drizzle apps/room/dist

FROM oven/bun:${BUN_VERSION}-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=7740 \
    ROOM_APP_DIR=/app/room \
    MIGRATE_ON_START=true \
    MIGRATIONS_DIR=/app/drizzle

# Owned by root and read-only to the user the process runs as (the base image's `bun`, uid 1000); the modes come from
# the build stage.
COPY --from=build /app/apps/api/dist/main.js /app/main.js
COPY --from=build /app/apps/api/drizzle /app/drizzle
COPY --from=build /app/apps/room/dist /app/room

# The commit the image was built from, as the estate's service.version (the short hash, or local). Last, so a new
# commit rebuilds one metadata layer and not the copies above.
ARG OTEL_SERVICE_VERSION=local
ENV OTEL_SERVICE_VERSION=${OTEL_SERVICE_VERSION} \
    GIT_SHA=${OTEL_SERVICE_VERSION}

USER bun
EXPOSE 7740
STOPSIGNAL SIGTERM

# 503 while the process drains, so a container that is stopping is not healthy.
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:7740/api/health || exit 1

# Exec form: Bun is PID 1 and receives the SIGTERM itself (it drains and exits 0 within 20 s).
CMD ["bun", "/app/main.js"]
