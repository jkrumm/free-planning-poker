"""Per-room statistics calculation using Polars."""
import polars as pl
from pathlib import Path
from config import DATA_DIR


def calc_room_stats(room_id: int) -> dict:
    """Calculate statistics for a specific room."""
    data_dir = Path(DATA_DIR)

    # Load votes data filtered by room_id
    df_votes = pl.read_parquet(data_dir / "fpp_votes.parquet")

    # Filter by room_id
    votes = df_votes.filter(pl.col("room_id") == room_id)

    # Count of votes
    total_votes = votes.height

    if total_votes == 0:
        return {
            "votes": 0,
            "duration": 0,
            "estimations": 0,
            "estimations_per_vote": 0,
            "avg_min_estimation": 0,
            "avg_avg_estimation": 0,
            "avg_max_estimation": 0,
            "spectators": 0,
            "spectators_per_vote": 0
        }

    # Aggregate metrics
    metrics = votes.select([
        pl.col("duration").mean().alias("avg_duration"),
        pl.col("amount_of_estimations").sum().alias("total_estimations"),
        pl.col("min_estimation").mean().alias("avg_min"),
        pl.col("avg_estimation").mean().alias("avg_avg"),
        pl.col("max_estimation").mean().alias("avg_max"),
        pl.col("amount_of_spectators").sum().alias("total_spectators"),
    ]).row(0, named=True)

    duration = round(metrics["avg_duration"] or 0, 0)
    estimations = int(metrics["total_estimations"] or 0)
    estimations_per_vote = round(estimations / total_votes, 2) if total_votes > 0 else 0
    avg_min_estimation = round(metrics["avg_min"] or 0, 2)
    avg_avg_estimation = round(metrics["avg_avg"] or 0, 2)
    avg_max_estimation = round(metrics["avg_max"] or 0, 2)
    spectators = int(metrics["total_spectators"] or 0)
    spectators_per_vote = round(spectators / total_votes, 2) if total_votes > 0 else 0

    return {
        "votes": total_votes,
        "duration": duration,
        "estimations": estimations,
        "estimations_per_vote": estimations_per_vote,
        "avg_min_estimation": avg_min_estimation,
        "avg_avg_estimation": avg_avg_estimation,
        "avg_max_estimation": avg_max_estimation,
        "spectators": spectators,
        "spectators_per_vote": spectators_per_vote
    }
