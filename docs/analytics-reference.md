# FPP Analytics Reference

Moved verbatim from `fpp-analytics/AGENTS.md` to keep that file under its 8,000-byte budget (dotfiles `rules/writing-for-agents.md`). The pointers in that file say when to read each section.

### Polars Best Practices

```python
# GOOD: Use lazy evaluation where possible
lf = pl.scan_parquet(path)
result = lf.filter(...).select(...).collect()

# GOOD: Single collect() at the end
metrics = (
    lf.select([
        pl.len().alias("count"),
        pl.col("value").mean().alias("avg"),
    ])
    .collect()
)

# BAD: Multiple collect() calls
df = pl.read_parquet(path)  # Eager load
filtered = df.filter(...)    # Already collected
result = filtered.select(...) # Redundant

# GOOD: Use iter_rows(named=True) for dict conversion
for row in df.iter_rows(named=True):
    print(row["column_name"])

# GOOD: Type alias for clarity
from typing import TypeAlias
DataFrame: TypeAlias = pl.DataFrame
LazyFrame: TypeAlias = pl.LazyFrame
```

### FastAPI Patterns

```python
# Router structure
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()

@router.get("/endpoint")
async def endpoint():
    """Docstring appears in OpenAPI docs."""
    return {"data": result}

# Authentication via dependency
def verify_auth(authorization: str = Header(None)):
    if authorization != EXPECTED_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

# Apply to router
app.include_router(router, dependencies=[Depends(verify_auth)])
```

### Error Handling

**Pattern:** Always log via Python logging; OTEL log records emit in parallel to ClickStack/HyperDX.

**Import:**
```python
from util.error_capture import ErrorContext, capture_error, add_error_breadcrumb
```

**Behavior:**

| Environment | Python logging | OTEL (ClickStack) |
|-------------|---------------|-------------------|
| development | ✅ Console logs | ✅ → localhost:4317 (local ClickStack) |
| production  | ✅ Console logs | ✅ → clickstack:4317 (docker bridge) |

OTEL endpoint and service name come from `OTEL_EXPORTER_OTLP_ENDPOINT` and
`OTEL_SERVICE_NAME`. No environment gate — telemetry always emits; pointing
at a missing collector just silently drops batches.

#### FastAPI Endpoints

```python
from fastapi import APIRouter, HTTPException
from util.error_capture import ErrorContext, capture_error, add_error_breadcrumb

@router.get("/analytics")
async def get_analytics():
    try:
        add_error_breadcrumb(
            message="Fetching analytics data",
            category="analytics",
            data={"endpoint": "get_analytics"}
        )

        result = calculate_metrics()
        return result

    except Exception as e:
        capture_error(
            e,
            ErrorContext(
                component="analytics_router",
                action="get_analytics",
                extra={"user_id": user_id}
            ),
            severity="high"
        )
        raise  # Let global handler return 500 response
```

#### Standalone Scripts (update_readmodel.py)

```python
from util.error_capture import ErrorContext, capture_error, add_error_breadcrumb

def main():
    add_error_breadcrumb("Starting sync", "sync", {"tables": ["fpp_votes"]})

    try:
        sync_tables()
    except Exception as e:
        capture_error(
            e,
            ErrorContext(
                component="update_readmodel",
                action="main",
                extra={"error_type": type(e).__name__}
            ),
            severity="critical"
        )
        sys.exit(1)
    finally:
        # Ensure OTEL spans + logs flush before exit
        shutdown_telemetry(_tracer_provider, _logger_provider)
```

#### HTTP Client Errors

```python
from util.error_capture import ErrorContext, capture_error

try:
    response = await client.post(url, json=data, timeout=30.0)
    if response.status_code != 200:
        error = EmailServiceError(f"Status {response.status_code}")
        capture_error(
            error,
            ErrorContext(
                component="http_client",
                action="send_email",
                extra={"url": url, "status": response.status_code}
            ),
            severity="medium"
        )
        raise error

except httpx.TimeoutException as e:
    capture_error(e, ErrorContext(...), severity="medium")
    raise
```

#### Severity Guidelines

| Severity | Use Case | Python Logging | OTEL SeverityNumber |
|----------|----------|----------------|---------------------|
| `critical` | Fatal errors, app crash | CRITICAL | FATAL (21) |
| `high` | User action blocked (DB error, API failure) | ERROR | ERROR (17) |
| `medium` | Degraded experience (email service down) | WARNING | WARN (13) |
| `low` | Informational (cache miss) | INFO | INFO (9) |

#### What NOT to Capture

```python
# ❌ Don't capture business logic errors
if room_id <= 0:
    raise HTTPException(status_code=400, detail="Invalid room_id")

# ❌ Don't capture validation errors
if not data:
    raise HTTPException(status_code=404, detail="Not found")

# ✅ Do capture system errors
try:
    df = pl.read_parquet(path)  # File might not exist
except Exception as e:
    capture_error(e, ErrorContext(...), "high")
    raise
```

#### Global Exception Handler

All unhandled exceptions are automatically captured by the global handler in `main.py`. Starlette 1.0 removed the `@app.exception_handler` decorator — handlers are passed via the `FastAPI(exception_handlers=...)` constructor argument:

```python
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    capture_error(exc, ErrorContext("global_handler", ...), "critical")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app = FastAPI(..., exception_handlers={Exception: global_exception_handler})
```

Note: `HTTPException` bypasses this handler (business logic errors are not captured).

## Directory Structure

```
fpp-analytics/
├── main.py                 # FastAPI app factory, auth, router mounting
├── update_readmodel.py     # Standalone sync script (runs in separate container)
├── config.py               # Environment configuration (os.getenv)
├── pyproject.toml          # Dependencies (managed by uv)
├── uv.lock                 # Lockfile (auto-generated)
├── Dockerfile              # Multi-stage uv build
├── .env.example            # Environment variable template
├── data/                   # Parquet files (created by updater)
│
├── routers/                # FastAPI route handlers
│   ├── __init__.py
│   ├── analytics.py        # GET / and /daily-analytics
│   ├── room.py             # GET /room/{id}/stats
│   └── health.py           # GET /health (public)
│
├── calculations/           # Pure Polars data transformations
│   ├── __init__.py
│   ├── traffic.py          # Unique users, page views, bounce rate, duration
│   ├── votes.py            # Vote counts, estimations, weekday distribution
│   ├── behaviour.py        # Routes, sources, events, room popularity
│   ├── reoccurring.py      # Returning users/rooms time series
│   ├── historical.py       # Daily metrics with 30-day moving averages
│   ├── location.py         # Device, OS, browser, country breakdown
│   ├── room_stats.py       # Per-room statistics
│   └── daily.py            # Last 24h metrics for email reports
│
└── util/                   # Shared utilities
    ├── __init__.py
    └── http_client.py      # Async httpx client for external services
```

---

## Key Files Explained

### `main.py`
- FastAPI app with lifespan context manager
- OTEL TracerProvider + LoggerProvider + FastAPI instrumentation on startup
- Bearer token authentication dependency
- Router mounting with auth dependencies

### `update_readmodel.py`
- Standalone script (not imported by FastAPI)
- Connects directly to MySQL
- Incremental sync by tracking max(id) or max(created_at)
- Pushes heartbeat to UptimeKuma on success/failure
- Run via: `python update_readmodel.py`

### `config.py`
- All configuration from environment variables
- `DB_CONFIG` dict for MySQL connection
- `DATA_DIR` for Parquet file location
- `START_DATE` constant for historical analytics baseline

### `calculations/*.py`
- Pure functions that read Parquet and return dicts
- No side effects, no database access
- Each function is independently testable
- Return types are always `dict` or `list[dict]`

---

## Data Model

### Parquet Files

| File | Key Columns | Sync Column |
|------|-------------|-------------|
| `fpp_estimations.parquet` | user_id, room_id, estimation, estimated_at | id |
| `fpp_events.parquet` | user_id, event, created_at | id |
| `fpp_page_views.parquet` | user_id, route, source, viewed_at | id |
| `fpp_rooms.parquet` | id, name, number, first_used_at | id |
| `fpp_votes.parquet` | room_id, voted_at, duration, avg/min/max_estimation | id |
| `fpp_users.parquet` | user_id, device, os, browser, country, created_at | created_at |

### Important Constants

- `START_DATE = "2024-06-03"` - Analytics baseline date
- Sync interval: 10 minutes (600 seconds)
- Session timeout: 10 minutes (for duration calculation)
- Moving average window: 30 days

---

## Common Tasks

### Adding a New Calculation

1. Create file in `calculations/`:
```python
# calculations/new_metric.py
import polars as pl
from pathlib import Path
from config import DATA_DIR

def calc_new_metric() -> dict:
    """Calculate new metric from Parquet files."""
    data_dir = Path(DATA_DIR)
    df = pl.read_parquet(data_dir / "fpp_votes.parquet")

    result = df.select([
        pl.col("column").mean().alias("avg_value")
    ]).row(0, named=True)

    return {
        "avg_value": round(result["avg_value"] or 0, 2)
    }
```

2. Export from `calculations/__init__.py`
3. Add to router in `routers/analytics.py`

### Adding a New Endpoint

```python
# routers/analytics.py
from calculations.new_metric import calc_new_metric

@router.get("/new-endpoint")
async def get_new_metric():
    """New endpoint description."""
    return calc_new_metric()
```

### Adding a New Table to Sync

1. Add to `TABLES` dict in `update_readmodel.py`:
```python
TABLES = {
    # ... existing tables
    'fpp_new_table': 'id',  # or 'created_at' if no auto-increment
}
```

2. Create calculation functions that read the new Parquet file

### Running Locally

```bash
# Install dependencies
uv sync

# Run API server
export ANALYTICS_SECRET_TOKEN="dev-token"
export DATA_DIR="./data"
uv run uvicorn main:app --reload --port 5100

# Run updater (requires DB access)
export DB_HOST="localhost" DB_PORT="3306" DB_USERNAME="fpp" DB_PASSWORD="xxx"
uv run python update_readmodel.py
```

### Validating Changes

```bash
# Check imports work
uv run python -c "from main import app; print('OK')"

# Check all calculations import
uv run python -c "from calculations import *; print('OK')"

# Test API locally
curl http://localhost:5100/health
curl -H "Authorization: dev-token" http://localhost:5100/
```

---

## Performance Considerations

### Polars Optimization

- **Lazy evaluation**: Use `pl.scan_parquet()` + `.collect()` at the end
- **Column selection**: Only read columns you need
- **Predicate pushdown**: Filter early in the chain
- **Avoid loops**: Use Polars expressions instead of Python loops where possible

### Current Data Size

~2.3 MB total Parquet data. Performance is not a concern at this scale. If data grows 100x+, consider:
- Partitioning by date
- Pre-computing aggregates
- Adding a caching layer

### Request Latency

Expected: 100-500ms per request (on-demand computation). This is acceptable for the low-traffic analytics dashboard.

---

## Deployment Notes

### Docker Configuration

The **Dockerfile lives here**; only the compose/orchestration config is external, in the
[vps](https://github.com/jkrumm/vps) repo (`vps/apps/fpp/`, sibling to this monorepo root):
- **Dockerfile:** `fpp-analytics/Dockerfile` — one image for both containers, built by
  `deploy.yml` with build context `fpp-analytics`. There is **no** `Dockerfile.updater`.
- **fpp-analytics-updater:** the *same* image under a separate name (so RollHook's container
  discovery can't conflate the two services). `deploy.yml` builds it from the same Dockerfile;
  `compose.yml` overrides the entrypoint to a sleep-loop around `update_readmodel.py` and
  replaces the HEALTHCHECK.
- **compose.yml:** `vps/apps/fpp/compose.yml`

Local development runs directly via `uv run uvicorn`. Production runs containerized on CPS.

### Docker Containers

- **fpp-analytics**: FastAPI server, proxy network only, read-only volume
- **fpp-analytics-updater**: Sync script, db network only, read-write volume

### Environment Variables

See `config.py` for all variables. Critical ones:
- `ANALYTICS_SECRET_TOKEN` - API authentication
- `DATA_DIR` - Parquet file location (`/app/data` in Docker)
- `DB_*` - Database connection (updater only)

### Monitoring

- **OpenTelemetry → ClickStack/HyperDX**: Traces, logs, exception capture for both containers
- **UptimeKuma**: Push-based heartbeat from updater (every 10 min)
- **Health endpoint**: `/health` for container health checks

---
