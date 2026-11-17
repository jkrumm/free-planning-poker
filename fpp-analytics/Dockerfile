# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS builder
WORKDIR /app

ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PROJECT_ENVIRONMENT=/app/.venv

# --no-build: install wheels only, never run an sdist's setup scripts. The app
# itself is not installed: its sources are copied below and run from /app.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project --no-build

COPY main.py config.py update_readmodel.py ./
COPY calculations ./calculations
COPY routers ./routers
COPY util ./util


FROM python:3.14-slim-bookworm AS runner
WORKDIR /app

# Cache mounts are not persisted into the layer, so the image still ships an
# empty /var/lib/apt/lists and the `rm -rf` this replaces was redundant.
# Verified: identical image size with and without the docker-clean removal.
#
# docker-clean must go first. Debian's /etc/apt/apt.conf.d/docker-clean drops
# both the downloaded .debs and the package indices in a post-invoke hook, so
# with it in place both mounts stay empty and cache nothing at all.
#
# Caveat: this only pays off on a builder that keeps its state. deploy.yml
# builds on a fresh GitHub runner and BuildKit cache mounts are not carried by
# cache-from/cache-to, so in CI these mounts start empty every run. They're
# kept because they cost nothing and speed up repeated local builds.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean \
  && apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && groupadd --system app && useradd --system --gid app --home-dir /app app

COPY --from=builder /app /app

# Short git SHA, passed by deploy.yml (build_args). Read at runtime as
# service.version; stays 'local' for builds that pass nothing.
ARG OTEL_SERVICE_VERSION=local
ENV OTEL_SERVICE_VERSION=${OTEL_SERVICE_VERSION} \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    DATA_DIR=/app/data

RUN mkdir -p /app/data && chown -R app:app /app/data

EXPOSE 5100
USER app

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:5100/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5100", "--workers", "1", "--no-access-log"]
