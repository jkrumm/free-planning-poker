"""Historical analytics with moving averages using Polars."""
import polars as pl
from pathlib import Path
from datetime import datetime, timedelta
from config import DATA_DIR, START_DATE


def calc_historical() -> list[dict]:
    """Calculate historical daily metrics with moving averages."""
    data_dir = Path(DATA_DIR)

    # Load all necessary data
    df_users = pl.read_parquet(data_dir / "fpp_users.parquet", columns=["created_at"])
    df_page_views = pl.read_parquet(data_dir / "fpp_page_views.parquet", columns=["viewed_at"])
    df_rooms = pl.read_parquet(data_dir / "fpp_rooms.parquet", columns=["first_used_at"])
    df_estimations = pl.read_parquet(data_dir / "fpp_estimations.parquet", columns=["estimated_at"])
    df_votes = pl.read_parquet(data_dir / "fpp_votes.parquet", columns=["voted_at"])

    # Create date range
    start_date = datetime.strptime(START_DATE, "%Y-%m-%d").date()
    end_date = datetime.now().date()

    historical = []
    acc_new_users = 0
    acc_page_views = 0
    acc_rooms = 0
    acc_estimations = 0
    acc_votes = 0

    current_date = start_date
    while current_date <= end_date:
        # Skip Saturday (5) and Sunday (6)
        if current_date.weekday() in [5, 6]:
            current_date += timedelta(days=1)
            continue

        # Count metrics for this date
        new_users = df_users.filter(pl.col("created_at").dt.date() == current_date).height
        acc_new_users += new_users

        page_views = df_page_views.filter(pl.col("viewed_at").dt.date() == current_date).height
        acc_page_views += page_views

        rooms = df_rooms.filter(pl.col("first_used_at").dt.date() == current_date).height
        acc_rooms += rooms

        estimations = df_estimations.filter(pl.col("estimated_at").dt.date() == current_date).height
        acc_estimations += estimations

        votes = df_votes.filter(pl.col("voted_at").dt.date() == current_date).height
        acc_votes += votes

        historical.append({
            "date": current_date.isoformat(),
            "new_users": new_users,
            "acc_new_users": acc_new_users,
            "page_views": page_views,
            "acc_page_views": acc_page_views,
            "rooms": rooms,
            "acc_rooms": acc_rooms,
            "estimations": estimations,
            "acc_estimations": acc_estimations,
            "votes": votes,
            "acc_votes": acc_votes,
            "ma_new_users": None,
            "ma_page_views": None,
            "ma_votes": None,
            "ma_rooms": None,
            "ma_estimations": None,
        })

        current_date += timedelta(days=1)

    # Calculate moving averages using Polars
    df_historical = pl.DataFrame(historical)
    window_size = 30

    df_historical = df_historical.with_columns([
        pl.col("new_users").rolling_mean(window_size=window_size).alias("ma_new_users"),
        pl.col("page_views").rolling_mean(window_size=window_size).alias("ma_page_views"),
        pl.col("votes").rolling_mean(window_size=window_size).alias("ma_votes"),
        pl.col("rooms").rolling_mean(window_size=window_size).alias("ma_rooms"),
        pl.col("estimations").rolling_mean(window_size=window_size).alias("ma_estimations"),
    ])

    # Convert back to list of dicts with rounded values
    result = []
    for row in df_historical.iter_rows(named=True):
        result.append({
            "date": row["date"],
            "new_users": row["new_users"],
            "acc_new_users": row["acc_new_users"],
            "page_views": row["page_views"],
            "acc_page_views": row["acc_page_views"],
            "rooms": row["rooms"],
            "acc_rooms": row["acc_rooms"],
            "estimations": row["estimations"],
            "acc_estimations": row["acc_estimations"],
            "votes": row["votes"],
            "acc_votes": row["acc_votes"],
            "ma_new_users": round(row["ma_new_users"], 2) if row["ma_new_users"] is not None else None,
            "ma_page_views": round(row["ma_page_views"], 2) if row["ma_page_views"] is not None else None,
            "ma_votes": round(row["ma_votes"], 2) if row["ma_votes"] is not None else None,
            "ma_rooms": round(row["ma_rooms"], 2) if row["ma_rooms"] is not None else None,
            "ma_estimations": round(row["ma_estimations"], 2) if row["ma_estimations"] is not None else None,
        })

    return result
