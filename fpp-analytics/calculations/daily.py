"""Daily analytics for email reports using Polars."""
import polars as pl
from pathlib import Path
from datetime import datetime, timedelta
from config import DATA_DIR


def calc_daily_analytics() -> dict:
    """Calculate last 24 hours analytics for daily email."""
    data_dir = Path(DATA_DIR)
    yesterday = datetime.now() - timedelta(days=1)

    # Load votes data filtered to last 24 hours
    df_votes = pl.read_parquet(data_dir / "fpp_votes.parquet")
    votes = df_votes.filter(pl.col("voted_at") > yesterday)

    # Count of votes
    total_votes = votes.height

    # Count of estimations
    estimations = int(votes["amount_of_estimations"].sum() or 0)

    # Amount of different rooms
    rooms = votes["room_id"].n_unique()

    # Load page view data filtered to last 24 hours
    df_page_views = pl.read_parquet(data_dir / "fpp_page_views.parquet")
    page_views_filtered = df_page_views.filter(pl.col("viewed_at") > yesterday)

    # Count unique users
    unique_users = page_views_filtered["user_id"].n_unique()

    # Count total page views
    page_views = page_views_filtered.height

    return {
        "votes": total_votes,
        "estimations": estimations,
        "rooms": rooms,
        "unique_users": unique_users,
        "page_views": page_views
    }
