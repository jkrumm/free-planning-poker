#!/usr/bin/env python3
"""
Standalone script to sync MySQL to flat Parquet files.
Runs every 10 minutes via docker entrypoint sleep loop.
Direct DB connection (same docker network) - no round-trip.
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()

# Imports after load_dotenv() to ensure environment variables are available
from datetime import UTC, datetime  # noqa: E402
from pathlib import Path  # noqa: E402
from typing import Any  # noqa: E402

import httpx  # noqa: E402
import polars as pl  # noqa: E402
import pymysql  # noqa: E402

from util.error_capture import (  # noqa: E402
    ErrorContext,
    add_error_breadcrumb,
    capture_error,
)
from util.telemetry import init_telemetry, shutdown_telemetry  # noqa: E402

# Bootstrap OTEL providers — same endpoint as the FastAPI server. The sleep
# loop in the sidecar means init runs once per python invocation.
_tracer_provider, _logger_provider, _meter_provider = init_telemetry()

DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))
UPTIMEKUMA_PUSH_URL = os.getenv("UPTIMEKUMA_PUSH_URL")

# DB config (same docker network on prod, public DNS in dev).
#
# DB_SSL=true forces a TLS handshake — required when MariaDB is started with
# --require-secure-transport=ON, which is the case on the VPS. DB_SSL_VERIFY=false
# keeps cert-chain validation but skips only the hostname check — needed when
# connecting to the internal `mariadb` hostname (the wildcard cert's CN is
# *.jkrumm.com and won't match). For external connections through
# fpp-db.jkrumm.com we'd flip DB_SSL_VERIFY back to true (full verification).
DB_CONFIG: dict[str, Any] = {
    "host": os.getenv("DB_HOST", "mariadb"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USERNAME", "fpp"),
    "password": os.getenv("DB_PASSWORD"),
    "database": "free-planning-poker",
    "charset": "utf8mb4",
}

if os.getenv("DB_SSL", "false").lower() == "true":
    import ssl as ssl_module  # noqa: E402

    ctx = ssl_module.create_default_context()
    if os.getenv("DB_SSL_VERIFY", "true").lower() == "false":
        # Validate the cert chain (CERT_REQUIRED, a publicly-trusted LE wildcard)
        # so a forged cert can't MITM the connection, but skip the hostname check
        # since the internal `mariadb` host won't match the wildcard SAN.
        ctx.check_hostname = False
        ctx.verify_mode = ssl_module.CERT_REQUIRED
    DB_CONFIG["ssl"] = ctx

# Table definitions: {table_name: sync_column}
# 5 tables sync by id, users syncs by created_at (no auto-increment PK)
TABLES = {
    "fpp_estimations": "id",
    "fpp_events": "id",
    "fpp_page_views": "id",
    "fpp_rooms": "id",
    "fpp_votes": "id",
    "fpp_users": "created_at",
}


def get_last_sync_value(parquet_path: Path, sync_col: str) -> Any:
    """Read last synced value from existing Parquet file metadata."""
    if not parquet_path.exists():
        return None
    lf = pl.scan_parquet(parquet_path)
    return lf.select(pl.col(sync_col).max()).collect().item()


def fetch_new_rows(
    conn: Any, table: str, sync_col: str, since_value: Any
) -> list[dict[str, Any]]:
    """Fetch new rows from MySQL since last sync."""
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    # Note: table and sync_col come from hardcoded TABLES dict, so they're safe.
    # Only since_value needs parameterization.
    if since_value is None:
        query = f"SELECT * FROM {table} ORDER BY {sync_col}"
        cursor.execute(query)
    else:
        query = f"SELECT * FROM {table} WHERE {sync_col} > %s ORDER BY {sync_col}"
        cursor.execute(query, (since_value,))

    return cursor.fetchall()  # type: ignore[no-any-return]


def sync_table(conn: Any, table: str, sync_col: str) -> int:
    """Sync a single table from MySQL to Parquet (atomic write)."""
    parquet_path = DATA_DIR / f"{table}.parquet"
    # PID in temp filename so two updater replicas during a RollHook 1→2→1
    # rolling deploy don't write to the same path. The atomic rename still
    # picks one consistent winner; the loser's snapshot is just dropped (the
    # DB query is idempotent — next iteration picks up from whichever
    # last_value lands in parquet).
    temp_path = DATA_DIR / f".{table}.parquet.{os.getpid()}.tmp"

    last_value = get_last_sync_value(parquet_path, sync_col)
    rows = fetch_new_rows(conn, table, sync_col, last_value)

    if not rows:
        return 0

    new_df = pl.DataFrame(rows, infer_schema_length=None)

    if parquet_path.exists():
        existing_df = pl.read_parquet(parquet_path)
        combined_df = pl.concat([existing_df, new_df])
    else:
        combined_df = new_df

    # Atomic write: temp file + rename (prevents race conditions)
    combined_df.write_parquet(temp_path)
    temp_path.rename(parquet_path)

    return len(rows)


def push_uptimekuma(status: str = "up", msg: str = "") -> None:
    """Push heartbeat to UptimeKuma cron monitor."""
    if not UPTIMEKUMA_PUSH_URL:
        return

    try:
        params = {"status": status, "msg": msg, "ping": ""}
        httpx.get(UPTIMEKUMA_PUSH_URL, params=params, timeout=10)
    except Exception as e:
        print(f"  UptimeKuma: failed to push - {e}")


def main() -> None:
    start_time = datetime.now()
    DATA_DIR.mkdir(exist_ok=True)
    total_records = 0
    errors = []

    add_error_breadcrumb(
        message="Starting read model sync",
        category="sync",
        data={"tables": list(TABLES.keys())},
    )

    try:
        conn = pymysql.connect(**DB_CONFIG)

        add_error_breadcrumb(
            message="Database connection established",
            category="database",
            data={"host": DB_CONFIG["host"]},
        )

        for table, sync_col in TABLES.items():
            try:
                add_error_breadcrumb(
                    message=f"Syncing table {table}",
                    category="sync",
                    data={"table": table, "sync_col": sync_col},
                )
                records_synced = sync_table(conn, table, sync_col)
                total_records += records_synced
                if records_synced > 0:
                    add_error_breadcrumb(
                        message=f"Synced {records_synced} records from {table}",
                        category="sync",
                        data={"table": table, "records": records_synced},
                    )
            except Exception as e:
                error_msg = f"{table}: {e}"
                print(f"[{datetime.now().isoformat()}] ERROR {error_msg}")
                errors.append(error_msg)
                capture_error(
                    e,
                    ErrorContext(
                        component="update_readmodel",
                        action="sync_table",
                        extra={
                            "table": table,
                            "sync_col": sync_col,
                            "error_msg": error_msg,
                        },
                    ),
                    severity="high",
                )

        conn.close()
        duration = (datetime.now() - start_time).total_seconds()

        # Summary log (always print)
        error_suffix = f", {len(errors)} errors" if errors else ""
        print(
            f"[{datetime.now().isoformat()}] Sync: {total_records} records ({duration:.1f}s){error_suffix}"
        )

        # Push to UptimeKuma
        if errors:
            push_uptimekuma("down", f"Errors: {', '.join(errors)}")
            sys.exit(1)
        else:
            # Write cache invalidation signal for FastAPI
            cache_status_path = DATA_DIR / "cache_status.txt"
            cache_status_path.write_text(datetime.now(UTC).isoformat())

            add_error_breadcrumb(
                message="Sync completed successfully",
                category="sync",
                data={"total_records": total_records, "duration": duration},
            )

            push_uptimekuma("up", f"Synced {total_records} records in {duration:.1f}s")

    except Exception as e:
        print(f"[{datetime.now().isoformat()}] FATAL: {e}")
        capture_error(
            e,
            ErrorContext(
                component="update_readmodel",
                action="main",
                extra={
                    "error_type": type(e).__name__,
                    "db_host": DB_CONFIG.get("host", "unknown"),
                },
            ),
            severity="critical",
        )
        push_uptimekuma("down", str(e))
        sys.exit(1)
    finally:
        # Ensure OTEL spans/logs/metrics flush before exit.
        shutdown_telemetry(_tracer_provider, _logger_provider, _meter_provider)


if __name__ == "__main__":
    main()
