"""Vote statistics calculation using Polars."""

from pathlib import Path
from typing import Any

import polars as pl

from config import DATA_DIR


def calc_votes() -> dict[str, Any]:
    """Calculate vote statistics from Parquet file."""
    data_dir = Path(DATA_DIR)
    lf = pl.scan_parquet(data_dir / "fpp_votes.parquet")

    # Aggregate all metrics in a single query
    metrics = lf.select(
        [
            pl.len().alias("total_votes"),
            pl.col("amount_of_estimations").sum().alias("total_estimations"),
            pl.col("amount_of_estimations").mean().alias("avg_estimations_per_vote"),
            pl.col("amount_of_spectators").mean().alias("avg_spectators_per_vote"),
            (pl.col("duration").mean() / 60).alias("avg_duration_per_vote"),
            pl.col("avg_estimation").mean().alias("avg_estimation"),
            pl.col("min_estimation").mean().alias("avg_min_estimation"),
            pl.col("max_estimation").mean().alias("avg_max_estimation"),
        ]
    ).collect()

    # Weekday distribution
    weekday_counts = (
        lf.with_columns(pl.col("voted_at").dt.weekday().alias("weekday"))
        .group_by("weekday")
        .len()
        .sort("weekday")
        .collect()
    )

    weekday_names = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
    ]
    weekday_dict = {
        weekday_names[row["weekday"] - 1]: row["len"]
        for row in weekday_counts.iter_rows(named=True)
    }

    # Estimation value distribution
    lf_estimations = pl.scan_parquet(data_dir / "fpp_estimations.parquet")
    estimation_counts = (
        lf_estimations.group_by("estimation").len().sort("estimation").collect()
    )

    estimation_dict = {
        int(row["estimation"]): row["len"]
        for row in estimation_counts.iter_rows(named=True)
        if row["estimation"] is not None
    }

    row = metrics.row(0, named=True)
    return {
        "total_votes": row["total_votes"],
        "total_estimations": int(row["total_estimations"] or 0),
        "avg_estimations_per_vote": round(row["avg_estimations_per_vote"] or 0, 2),
        "avg_spectators_per_vote": round(row["avg_spectators_per_vote"] or 0, 2),
        "avg_duration_per_vote": round(row["avg_duration_per_vote"] or 0, 2),
        "avg_estimation": round(row["avg_estimation"] or 0, 2),
        "avg_min_estimation": round(row["avg_min_estimation"] or 0, 2),
        "avg_max_estimation": round(row["avg_max_estimation"] or 0, 2),
        "weekday_counts": weekday_dict,
        "estimation_counts": estimation_dict,
    }
