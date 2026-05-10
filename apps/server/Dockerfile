FROM oven/bun:1.3-alpine AS builder
WORKDIR /app

# Build context is the monorepo root. With --frozen-lockfile, Bun verifies
# the entire workspace graph against bun.lock — every workspace member's
# package.json must be present, even if not part of the @fpp/server import
# graph. Manifests are cheap to copy and cache-friendly (only invalidate on
# package.json changes, not source).
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Install at workspace root so symlinks resolve correctly. No --production:
# `bun build --compile` produces a self-contained binary that inlines deps,
# so devDeps don't ship anyway and pruning them here just risks breaking
# build-time imports.
RUN bun install --frozen-lockfile --ignore-scripts

# Source files for the server build (workspace deps must be present at the
# paths referenced in the lockfile so Bun can resolve symlinks).
COPY apps/server/tsconfig.json ./apps/server/tsconfig.json
COPY apps/server/src ./apps/server/src
COPY packages/shared/src ./packages/shared/src

# Bun inlines process.env.NODE_ENV at compile time — must be set before `bun build`
# or production conditionals (tracking URL, log level, Sentry env) bake to dev defaults.
ENV NODE_ENV=production

WORKDIR /app/apps/server
RUN bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --target bun \
    --outfile /app/server \
    ./src/index.ts

FROM oven/bun:1.3-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl ca-certificates \
  && addgroup -S app && adduser -S app -G app

COPY --from=builder --chown=app:app /app/server /app/server

ENV NODE_ENV=production
EXPOSE 3003

USER app

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:3003/health || exit 1

CMD ["/app/server"]
