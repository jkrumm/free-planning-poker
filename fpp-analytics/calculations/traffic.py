"""Traffic statistics calculation using Polars."""
import polars as pl
from pathlib import Path
from datetime import timedelta
from config import DATA_DIR, START_DATE


def calc_traffic() -> dict:
    """Calculate traffic statistics from Parquet files."""
    data_dir = Path(DATA_DIR)

    # Load page view data
    df_page_views = pl.read_parquet(
        data_dir / "fpp_page_views.parquet",
        columns=["user_id", "viewed_at"]
    ).rename({"viewed_at": "activity_at"})

    # Count unique users
    unique_users = df_page_views["user_id"].n_unique()

    # Count total page views
    page_views = len(df_page_views)

    # BOUNCE RATE
    df_estimations = pl.read_parquet(
        data_dir / "fpp_estimations.parquet",
        columns=["user_id", "estimated_at"]
    ).rename({"estimated_at": "activity_at"})

    # Filter to entries after START_DATE
    start_ts = pl.lit(START_DATE).str.to_datetime()
    df_estimations_filtered = df_estimations.filter(pl.col("activity_at") > start_ts)
    df_page_views_filtered = df_page_views.filter(pl.col("activity_at") > start_ts)

    # Calculate bounce rate
    users_who_estimated = df_estimations_filtered["user_id"].n_unique()
    bounce_rate = round(1 - (users_who_estimated / unique_users), 2)

    # DURATION - Session calculation
    df_joined = pl.concat([
        df_page_views_filtered.select(["user_id", "activity_at"]),
        df_estimations_filtered.select(["user_id", "activity_at"])
    ])

    # Sort by user_id and activity_at
    df_joined = df_joined.sort(["user_id", "activity_at"])

    # Calculate time difference and detect new sessions
    df_joined = df_joined.with_columns([
        pl.col("activity_at").diff().alias("time_diff"),
        pl.col("user_id").shift(1).alias("prev_user_id"),
    ])

    # New session if time_diff > 10 minutes or different user
    df_joined = df_joined.with_columns([
        (
            (pl.col("time_diff") > timedelta(minutes=10)) |
            (pl.col("user_id") != pl.col("prev_user_id")) |
            pl.col("time_diff").is_null()
        ).alias("new_session")
    ])

    # Assign session numbers
    df_joined = df_joined.with_columns([
        pl.col("new_session").cum_sum().alias("session")
    ])

    # Calculate session duration
    session_durations = df_joined.group_by("session").agg([
        pl.col("activity_at").min().alias("session_start"),
        pl.col("activity_at").max().alias("session_end"),
    ]).with_columns([
        ((pl.col("session_end") - pl.col("session_start")).dt.total_seconds() + 10).alias("adjusted_duration")
    ])

    # Average duration in minutes
    avg_duration_seconds = session_durations["adjusted_duration"].mean()
    average_duration = round((avg_duration_seconds or 0) / 60, 2)

    return {
        "unique_users": unique_users,
        "page_views": page_views,
        "bounce_rate": bounce_rate,
        "average_duration": average_duration
    }
