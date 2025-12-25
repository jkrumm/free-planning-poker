#!/usr/bin/env python3
"""
Standalone script to sync MySQL to flat Parquet files.
Runs every 15 minutes via docker entrypoint sleep loop.
Direct DB connection (same docker network) - no round-trip.
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

import polars as pl
import pymysql
import httpx
import sentry_sdk
from pathlib import Path
from datetime import datetime

# Initialize Sentry for error tracking
SENTRY_DSN = os.getenv('FPP_ANALYTICS_SENTRY_DSN')
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=os.getenv('SENTRY_ENVIRONMENT', 'production'),
        traces_sample_rate=0.1,
    )

DATA_DIR = Path(os.getenv('DATA_DIR', './data'))
UPTIMEKUMA_PUSH_URL = os.getenv('UPTIMEKUMA_PUSH_URL')

# DB config (same docker network)
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'mariadb'),
    'port': int(os.getenv('DB_PORT', '3306')),
    'user': os.getenv('DB_USERNAME', 'fpp'),
    'password': os.getenv('DB_PASSWORD'),
    'database': 'free-planning-poker',
    'charset': 'utf8mb4',
}

# Table definitions: {table_name: sync_column}
# 5 tables sync by id, users syncs by created_at (no auto-increment PK)
TABLES = {
    'fpp_estimations': 'id',
    'fpp_events': 'id',
    'fpp_page_views': 'id',
    'fpp_rooms': 'id',
    'fpp_votes': 'id',
    'fpp_users': 'created_at',
}


def get_last_sync_value(parquet_path: Path, sync_col: str):
    """Read last synced value from existing Parquet file metadata."""
    if not parquet_path.exists():
        return None
    lf = pl.scan_parquet(parquet_path)
    return lf.select(pl.col(sync_col).max()).collect().item()


def fetch_new_rows(conn, table: str, sync_col: str, since_value) -> list[dict]:
    """Fetch new rows from MySQL since last sync."""
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    if since_value is None:
        query = f"SELECT * FROM {table} ORDER BY {sync_col}"
    elif sync_col == 'id':
        query = f"SELECT * FROM {table} WHERE {sync_col} > {since_value} ORDER BY {sync_col}"
    else:
        # Timestamp-based (users table)
        query = f"SELECT * FROM {table} WHERE {sync_col} > '{since_value}' ORDER BY {sync_col}"

    cursor.execute(query)
    return cursor.fetchall()


def sync_table(conn, table: str, sync_col: str) -> int:
    """Sync a single table from MySQL to Parquet (atomic write)."""
    parquet_path = DATA_DIR / f"{table}.parquet"
    temp_path = DATA_DIR / f".{table}.parquet.tmp"

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


def push_uptimekuma(status: str = "up", msg: str = ""):
    """Push heartbeat to UptimeKuma cron monitor."""
    if not UPTIMEKUMA_PUSH_URL:
        return

    try:
        params = {"status": status, "msg": msg, "ping": ""}
        httpx.get(UPTIMEKUMA_PUSH_URL, params=params, timeout=10)
        print(f"  UptimeKuma: pushed {status}")
    except Exception as e:
        print(f"  UptimeKuma: failed to push - {e}")


def main():
    start_time = datetime.now()
    DATA_DIR.mkdir(exist_ok=True)
    total_records = 0
    errors = []

    try:
        conn = pymysql.connect(**DB_CONFIG)

        for table, sync_col in TABLES.items():
            try:
                total_records += sync_table(conn, table, sync_col)
            except Exception as e:
                error_msg = f"{table}: {e}"
                print(f"[{datetime.now().isoformat()}] ERROR {error_msg}")
                errors.append(error_msg)
                sentry_sdk.capture_exception(e)

        conn.close()
        duration = (datetime.now() - start_time).total_seconds()

        # Summary log (always print)
        error_suffix = f", {len(errors)} errors" if errors else ""
        print(f"[{datetime.now().isoformat()}] Sync: {total_records} records ({duration:.1f}s){error_suffix}")

        # Push to UptimeKuma
        if errors:
            push_uptimekuma("down", f"Errors: {', '.join(errors)}")
            sys.exit(1)
        else:
            push_uptimekuma("up", f"Synced {total_records} records in {duration:.1f}s")

    except Exception as e:
        print(f"[{datetime.now().isoformat()}] FATAL: {e}")
        sentry_sdk.capture_exception(e)
        push_uptimekuma("down", str(e))
        sys.exit(1)


if __name__ == '__main__':
    main()
