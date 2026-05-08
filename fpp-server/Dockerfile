FROM oven/bun:1.3-alpine AS builder
WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile --production --ignore-scripts

# Bun inlines process.env.NODE_ENV at compile time — must be set before `bun build`
# or production conditionals (tracking URL, log level, Sentry env) bake to dev defaults.
ENV NODE_ENV=production

COPY src ./src
RUN bun build \
    --compile \
    --minify-whitespace \
    --minify-syntax \
    --target bun \
    --outfile server \
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
