# FPP Analytics - AI Development Guide

## Project Overview

**FPP Analytics** is a lightweight Python analytics stack for Free Planning Poker. It provides on-demand analytics calculations from Parquet files, updated every 15 minutes from a MySQL database.

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
2. **fpp-analytics-updater**: Sync script (writes Parquet from MySQL every 15 min)

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

```python
# Use Sentry for error tracking
import sentry_sdk

try:
    result = risky_operation()
except Exception as e:
    sentry_sdk.capture_exception(e)
    raise  # Re-raise after logging

# For expected errors, use HTTPException
if not data:
    raise HTTPException(status_code=404, detail="Not found")
```

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
- Sync interval: 15 minutes (900 seconds)
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
- **UptimeKuma**: Push-based heartbeat from updater (every 15 min)
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
