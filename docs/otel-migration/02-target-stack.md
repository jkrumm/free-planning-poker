# 02 — Target Stack: VPS ClickStack / HyperDX

**Purpose:** target environment spec. Precise endpoints, ports, auth headers, env-var names. fpp will join `traefik`, `rollhook`, `argo-api`, `argo-dashboard` as a producer.

**Source repo:** `~/SourceRoot/vps`.

---

## What's running

- **Image:** `clickhouse/clickstack-all-in-one:latest` (the ClickHouse-branded variant; Watchtower auto-updates).
- **Bundles:** ClickHouse + OTel Collector + HyperDX UI + MongoDB.
- **Resource limits:** none configured. Shares VPS RAM pool (24 GB).
- **Retention:** no TTL configured. ClickHouse stores indefinitely. Action item before fpp goes live: set 30-day TTL on `otel_traces` + `otel_logs`.

### Compose files

- `vps/compose.monitoring.yml` — production
- `vps/compose.dev.yml` — local dev (exposes ports to host)
- `vps/compose.networking.yml` — Traefik integration

### Custom OTel Collector config

`vps/clickstack/otel-custom.yaml` merged into bundled config via `CUSTOM_OTELCOL_CONFIG_FILE`. Adds the **unauthed `:4319` receiver** plus parallel pipelines that exporter into ClickHouse.

---

## Two-tier OTLP ingestion (intentional)

| Receiver | Port | Auth | Transport | Network | Used by |
|-|-|-|-|-|-|
| `otlp/hyperdx` (bundled) | 4317 / 4318 | `bearertokenauth` | gRPC + HTTP | All networks | Browser SDKs, cross-host |
| `otlp/internal` (custom) | 4319 | None | HTTP | docker `monitoring-net` only | Traefik, RollHook, argo-api |

Why split: Traefik 3.x has unfixed bugs around env-var substitution in static YAML headers (traefik-helm-chart#1361). Authed `:4318` via Traefik labels fails for header-based auth from inside Docker. Trust boundary on `:4319` is docker network membership; trust boundary on `:4318` is the bearer token.

**Implication for fpp:**

- `fpp-server` (Docker on VPS) → `http://clickstack:4319`, no auth.
- `fpp-analytics` (Docker on VPS) → `http://clickstack:4319`, no auth.
- `apps/web` (Vercel, external) → `https://otel.jkrumm.com` with `authorization` header.
- Browser SDK → same-origin route via Traefik label on the fpp host (or cross-origin to `otel.jkrumm.com` with bearer; same-origin avoids CORS preflight).

---

## Endpoints

### Public (via Cloudflare tunnel → Traefik)

| Endpoint | URL | Port | Auth | Use |
|-|-|-|-|-|
| HyperDX UI | `https://hyperdx.${DOMAIN}` | 8080 | First-visit signup | DNS-only A record (Tailscale-only access) |
| OTLP HTTP traces | `https://otel.${DOMAIN}/v1/traces` | 4318 | `authorization: <ingestion-key>` | Public |
| OTLP HTTP logs | `https://otel.${DOMAIN}/v1/logs` | 4318 | `authorization: <ingestion-key>` | Public |
| OTLP gRPC | `otel.${DOMAIN}:443` | 4317 | gRPC metadata `authorization` | Public, server-to-server |
| Healthcheck | `${VPS_TAILSCALE_IP}:13133/status` | 13133 | None | Tailscale-only, Uptime Kuma monitors |

### Internal (Docker `monitoring-net`)

| Endpoint | URL | Auth |
|-|-|-|
| OTLP HTTP | `http://clickstack:4319/v1/traces` | none |
| OTLP HTTP | `http://clickstack:4319/v1/logs` | none |

### Local dev (host-exposed via `compose.dev.yml`)

| Endpoint | URL | Auth |
|-|-|-|
| HyperDX UI | `http://localhost:7707` (or `https://hyperdx.test` via Caddy) | first-visit signup |
| OTLP gRPC (authed) | `localhost:4317` | bearer |
| OTLP HTTP (authed) | `localhost:4318` | bearer |
| OTLP HTTP (unauthed) | `localhost:4319` | none |

Local fpp services point at `http://localhost:4319` (matches Argo's local convention).

---

## Same-origin OTLP route (browser SDK)

To avoid CORS preflight from the browser, add Traefik labels to the fpp web container (only relevant if Next.js were on the VPS — Vercel-hosted Next.js must use cross-origin `https://otel.${DOMAIN}` with bearer). For the browser SDK in production:

```yaml
- "traefik.http.routers.fpp-otel-traces.rule=Host(`free-planning-poker.com`) && Path(`/v1/traces`)"
- "traefik.http.routers.fpp-otel-traces.service=clickstack-otel@docker"
```

Since fpp's web is on Vercel, not the VPS, this label-trick doesn't apply directly. Two options:

1. **Cross-origin browser ingest** to `https://otel.${DOMAIN}` with bearer (publicly exposed key — same threat model as a Sentry DSN).
2. **Vercel rewrite** that proxies `/v1/traces` from `free-planning-poker.com` to `https://otel.${DOMAIN}`, injecting auth at the edge. Cleaner but adds latency.

PRD picks option 1 for v1 — see [PRD §4](PRD.md#4-architecture).

---

## ClickHouse schema (default tables)

Created automatically by ClickStack on first ingest:

```text
default.otel_traces            -- TraceId, SpanId, ParentSpanId, SpanName, SpanKind, ServiceName,
                                  Duration, StatusCode, StatusMessage, SpanAttributes,
                                  ResourceAttributes
default.otel_logs              -- Timestamp, TimestampTime, SeverityText, SeverityNumber,
                                  ServiceName, Body, LogAttributes, TraceId, SpanId
default.otel_metrics_sum
default.otel_metrics_gauge
default.otel_metrics_histogram
```

Query via `docker exec clickstack clickhouse-client`. The `/otel` skill in `~/.claude/skills/otel/` ships query presets (health, services, errors, slow, trace, trace-logs, log-search).

---

## Existing producers

| Service | Endpoint | Env var | service.name |
|-|-|-|-|
| traefik | `clickstack:4319` (static YAML) | n/a | `traefik` |
| rollhook | `clickstack:4319` | `OTEL_EXPORTER_OTLP_ENDPOINT` | `rollhook` |
| argo-api | `clickstack:4319` | `OTEL_EXPORTER_OTLP_ENDPOINT` | `argo-api` |
| argo-dashboard (browser) | same-origin via Traefik label | `VITE_HYPERDX_API_KEY` | varies |

fpp will add: `free-planning-poker` (web), `fpp-server` (Bun), `fpp-analytics` (Python).

---

## 1Password vault paths

| Path | Purpose |
|-|-|
| `op://vps/clickstack/EXPRESS_SESSION_SECRET` | HyperDX session cookie encryption. |
| `op://vps/argo/HYPERDX_API_KEY_PROD` | Public bearer for `otel.${DOMAIN}` ingest. Currently shared; new fpp PRD recommends per-service keys. |
| `op://vps/argo/HYPERDX_API_KEY_LOCAL` | Local-dev bearer (only needed if pointing at authed `:4318` locally). |
| `op://vps/hyperdx/service-key` *(create during Phase 6)* | Source-map upload, **distinct** from ingestion key. |

Rotation: generate in HyperDX UI → Team Settings → API Keys → update 1Password → `cd dotfiles && make github-config` to fan out → redeploy consumers.

---

## Network topology summary

```text
                                                         ┌─────────────────┐
                                                         │  Vercel         │
                                                         │  apps/web       │
                                                         └────────┬────────┘
                                                                  │
                                                                  │ HTTPS + bearer
                                                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Cloudflare Tunnel → VPS Traefik                                          │
│  otel.${DOMAIN}:443  →  clickstack:4318 (authed bearer)                  │
│  hyperdx.${DOMAIN}:443  →  clickstack:8080  (Tailscale-only)             │
└──────────────────────────────────────────────────────────────────────────┘

                       ┌──────────────────────────────┐
                       │ Docker network: monitoring-net│
                       │ ┌──────────────────────────┐  │
                       │ │ clickstack:4319 (no auth)│  │
                       │ └──────────────────────────┘  │
                       │            ▲     ▲     ▲       │
                       │            │     │     │       │
                       │     ┌──────┘     │     └─────┐ │
                       │  ┌──┴──┐  ┌──────┴──┐  ┌─────┴──┐ │
                       │  │traef│  │rollhook │  │argo-api│ │
                       │  └─────┘  └─────────┘  └────────┘ │
                       │  ┌──────────┐  ┌──────────────┐   │
                       │  │fpp-server│  │fpp-analytics │← NEW
                       │  └──────────┘  └──────────────┘   │
                       └──────────────────────────────┘
```

---

## Pre-flight checklist (before Phase 1 of PRD)

- [ ] Confirm `clickstack` container is up: `ssh vps "docker ps --filter name=clickstack"`.
- [ ] Confirm `fpp-server` + `fpp-analytics` are on `monitoring-net` (or add them in `vps/apps/fpp/compose.yml`).
- [ ] Set 30-day TTL on `otel_traces` and `otel_logs` to bound disk growth.
- [ ] Generate new HyperDX ingestion key dedicated to fpp web (`op://vps/fpp/HYPERDX_INGESTION_KEY`). Reusing argo's key is acceptable for v1 but separate keys make rotation surgical.
- [ ] Add `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4319` to `.env.tpl` files (server, analytics).
- [ ] Decide browser-side strategy: cross-origin bearer vs. Vercel rewrite. PRD picks cross-origin.

---

## Related

- [01 — Sentry Audit](01-sentry-audit.md)
- [03 — Argo Reference](03-argo-reference.md)
- [04 — Research](04-research.md)
- [PRD](PRD.md)
