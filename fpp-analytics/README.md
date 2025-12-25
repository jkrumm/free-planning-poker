# FPP Analytics

FastAPI + Polars analytics stack for Free Planning Poker.

## Quick Start

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager
- Access to MariaDB (for updater) or existing Parquet files (for API only)

### Install Dependencies

```bash
cd fpp-analytics
uv sync
```

### Run FastAPI Server (Development)
> First create .env with required vars
```bash
uv run uvicorn main:app --reload --port 5100
```

### Run Updater Script (Development)

```bash
uv run python update_readmodel.py
```

---

## Doppler Secrets

### Required Secrets for `fpp-analytics`

| Secret | Description |
|--------|-------------|
| `ANALYTICS_SECRET_TOKEN` | Bearer token for API authentication |
| `FPP_ANALYTICS_SENTRY_DSN` | Sentry DSN (optional) |
| `BEA_BASE_URL` | Email service base URL (optional) |
| `BEA_SECRET_KEY` | Email service auth key (optional) |

### Required Secrets for `fpp-analytics-updater`

| Secret | Description |
|--------|-------------|
| `DB_FPP_PW` | MariaDB password for fpp user |
| `FPP_ANALYTICS_SENTRY_DSN` | Sentry DSN (optional) |
| `UPTIMEKUMA_PUSH_URL` | UptimeKuma push endpoint (optional) |

---

## Production Deployment

### Deploy to sideproject-docker-stack

1. **Ensure secrets are in Doppler:**
   ```bash
   doppler secrets get ANALYTICS_SECRET_TOKEN DB_FPP_PW FPP_ANALYTICS_SENTRY_DSN
   ```

2. **Build containers:**
   ```bash
   cd ~/SourceRoot/sideproject-docker-stack
   doppler run -- docker compose build --no-cache fpp-analytics fpp-analytics-updater
   ```

3. **Start updater first:**
   ```bash
   doppler run -- docker compose up -d fpp-analytics-updater

   # Wait for initial sync (check logs)
   docker logs -f fpp-analytics-updater
   # Should see "Sync complete in X.Xs"
   ```

4. **Start API server:**
   ```bash
   doppler run -- docker compose up -d fpp-analytics
   ```

5. **Verify:**
   ```bash
   # Health check
   curl http://localhost:5100/health

   # Main analytics (with auth)
   curl -H "Authorization: $ANALYTICS_SECRET_TOKEN" http://localhost:5100/
   ```

### Rebuild Single Container

```bash
./rebuild-container.sh fpp-analytics-updater
# or
./rebuild-container.sh fpp-analytics
```

---

## API Endpoints

### `GET /health` (Public)

Health check, verifies Parquet files exist.

```bash
curl http://localhost:5100/health
```

Response:
```json
{
  "status": "ok",
  "components": {
    "parquet_files": {
      "status": "ok",
      "files": {
        "fpp_estimations.parquet": true,
        "fpp_events.parquet": true,
        ...
      }
    },
    "storage": {
      "status": "ok",
      "data_size_mb": 2.34
    }
  }
}
```

### `GET /` (Authenticated)

Main analytics endpoint.

```bash
curl -H "Authorization: your-token" http://localhost:5100/
```

Response includes: traffic, votes, behaviour, reoccurring, historical, location_and_user_agent.

### `GET /room/{room_id}/stats` (Authenticated)

Room-specific statistics.

```bash
curl -H "Authorization: your-token" http://localhost:5100/room/123/stats
```

### `GET /daily-analytics` (Authenticated)

Calculates last 24h metrics and sends email report.

```bash
curl -H "Authorization: your-token" http://localhost:5100/daily-analytics
```

---

## Troubleshooting

### "No Parquet files found"

The updater hasn't run yet. Either:
- Run `update_readmodel.py` manually
- Start the updater container and wait for first sync

### "Unauthorized" on API calls

Check your `Authorization` header matches `ANALYTICS_SECRET_TOKEN`.

### Updater fails to connect to DB

- Verify `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`
- Ensure updater is on `db` network in docker-compose
- Check MariaDB is running: `docker ps | grep mariadb`

### High memory usage

Polars is efficient but loads data into memory. For the current ~2MB dataset this is fine. If data grows significantly, consider:
- Lazy evaluation (already used where possible)
- Partitioning Parquet files by date
- Pre-aggregating historical data
