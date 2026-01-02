# FPP Analytics - AI Development Guide

## Project Overview

**FPP Analytics** is a lightweight Python analytics stack for Free Planning Poker. It provides on-demand analytics calculations from Parquet files, updated every 10 minutes from a MySQL database.

### Tech Stack

| Component | Technology |
|-----------|------------|
| Web Framework | FastAPI 0.115+ |
| Data Processing | Polars 1.34+ |
| Database | MySQL/MariaDB (via mysql-connector-python) |
| HTTP Client | httpx (async) |
| Monitoring | Sentry SDK |
| Package Manager | uv |
| Runtime | Python 3.12+ |

### Architecture Summary

Two-container setup:
1. **fpp-analytics**: FastAPI server (reads Parquet, no DB access)
2. **fpp-analytics-updater**: Sync script (writes Parquet from MySQL every 10 min)

Data flows: `MySQL → Updater → Parquet files → FastAPI → Client`

---

## Code Standards

### Python Style

- **Python 3.12+** features allowed (type hints, match statements, etc.)
- Use **type hints** for all function signatures
- Prefer **f-strings** over format()
- Use **pathlib.Path** for file operations
- Avoid `pandas` - use **Polars** for all data operations

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

**Pattern:** Always log via Python logging, only send to Sentry in production.

**Import:**
```python
from util.sentry_wrapper import ErrorContext, capture_error, add_error_breadcrumb
```

**Behavior:**
| Environment | Python logging | Sentry |
|-------------|---------------|--------|
| development | ✅ Console logs | ❌ No Sentry |
| production  | ✅ Console logs | ✅ Sends to Sentry |

**Environment Detection:**
```python
SENTRY_ENVIRONMENT = os.getenv("SENTRY_ENVIRONMENT", "development")
SEND_TO_SENTRY = SENTRY_ENVIRONMENT == "production"
```

#### FastAPI Endpoints

```python
from fastapi import APIRouter, HTTPException
from util.sentry_wrapper import ErrorContext, capture_error, add_error_breadcrumb

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
from util.sentry_wrapper import ErrorContext, capture_error, add_error_breadcrumb

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
        # Ensure Sentry events are sent before exit
        if SENTRY_DSN:
            sentry_sdk.flush(timeout=5.0)
```

#### HTTP Client Errors

```python
from util.sentry_wrapper import ErrorContext, capture_error

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

| Severity | Use Case | Python Logging | Sentry (prod) |
|----------|----------|----------------|---------------|
| `critical` | Fatal errors, app crash | CRITICAL | fatal |
| `high` | User action blocked (DB error, API failure) | ERROR | error |
| `medium` | Degraded experience (email service down) | WARNING | warning |
| `low` | Informational (cache miss) | INFO | info |

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

All unhandled exceptions are automatically captured by the global handler in `main.py`:
```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    capture_error(exc, ErrorContext("global_handler", ...), "critical")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
```

Note: `HTTPException` bypasses this handler (business logic errors are not captured).

## Validation & Code Quality

### Tooling

| Tool | Purpose |
|------|---------|
| **Ruff** | Linter + Formatter (replaces Flake8, Black, isort) |
| **mypy** | Static type checker |

### Commands

**Via root npm:**
```bash
npm run fpp-analytics:format:check   # Check formatting
npm run fpp-analytics:format         # Auto-fix formatting
npm run fpp-analytics:lint           # Check linting
npm run fpp-analytics:lint:fix       # Auto-fix linting
npm run fpp-analytics:type-check     # Type checking
npm run fpp-analytics:validate       # All checks combined
```

**Direct uv:**
```bash
cd fpp-analytics
uv run ruff format .        # Auto-fix formatting
uv run ruff format --check . # Check formatting
uv run ruff check .         # Check linting
uv run ruff check --fix .   # Auto-fix linting
uv run mypy .               # Type checking
```

### Ruff Configuration

- **Python 3.12**
- **Line length**: 88 (Black compatible)
- **Rules**: E, W, F, I, B, C4, UP, ARG, SIM
- **Ignores**: E501 (line length), B008 (FastAPI Depends)

### mypy Configuration

Strict mode (equivalent to TypeScript `strict: true`):
- All functions must have type hints
- No `Any` types without justification
- Pragmatic ignores for Polars/httpx (incomplete stubs)

### Type Hint Requirements

```python
# ✅ Good
def calc_metric(df: pl.DataFrame) -> dict:
    return {"value": 42}

# ❌ Bad (mypy error)
def calc_metric(df):
    return {"value": 42}
```

### CI Validation

3 parallel GitHub Actions jobs on every PR:
1. Formatting (Ruff)
2. Linting (Ruff)
3. Type checking (mypy)

---

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
- Sentry initialization on startup
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

Docker configuration is **NOT in this repository**. It lives in:
- **Location:** `/Users/johannes.krumm/SourceRoot/sideproject-docker-stack/fpp_analytics/`
- **Dockerfile:** `Dockerfile` (FastAPI server)
- **Dockerfile.updater:** `Dockerfile.updater` (sync script)
- **docker-compose.yml:** In parent `sideproject-docker-stack/` directory

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

- **Sentry**: Error tracking for both containers
- **UptimeKuma**: Push-based heartbeat from updater (every 10 min)
- **Health endpoint**: `/health` for container health checks

---

## DO NOT

- **Do not use pandas** - Always use Polars
- **Do not add caching** - On-demand computation is the design goal
- **Do not add database connection to FastAPI** - Only updater accesses DB
- **Do not modify Parquet files from FastAPI** - Read-only access
- **Do not use APScheduler or in-process scheduling** - Updater runs in separate container
- **Do not use gunicorn** - Use uvicorn directly
- **Do not use requirements.txt** - Use pyproject.toml + uv

---

## Troubleshooting for AI Agents

### Import Errors

Check that all `__init__.py` files export the necessary functions.

### "File not found" for Parquet

The updater hasn't run. DATA_DIR must contain the Parquet files.

### Type Errors with Polars

Polars is strict about types. Use `.cast()` for explicit conversions:
```python
df.with_columns(pl.col("room_id").cast(pl.Int32))
```

### Null Handling

Polars returns `None` for null values. Always handle:
```python
value = result["column"]
safe_value = round(value or 0, 2)
```
