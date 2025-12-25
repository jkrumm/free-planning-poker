"""Reoccurring users and rooms time series using Polars."""
import polars as pl
from pathlib import Path
from datetime import datetime, timedelta
from config import DATA_DIR, START_DATE


def calc_reoccurring() -> list[dict]:
    """Calculate reoccurring users and rooms time series."""
    data_dir = Path(DATA_DIR)

    # Load estimation data
    df_estimations = pl.read_parquet(
        data_dir / "fpp_estimations.parquet",
        columns=["user_id", "room_id", "estimated_at"]
    )

    # Create date range from START_DATE to today
    start_date = datetime.strptime(START_DATE, "%Y-%m-%d").date()
    end_date = datetime.now().date()

    reoccurring = []
    users: set = set()
    rooms: set = set()
    accounted_users: set = set()
    accounted_rooms: set = set()
    last_active_user: dict = {}
    last_active_room: dict = {}

    current_date = start_date
    while current_date <= end_date:
        # Skip Saturday (5) and Sunday (6)
        if current_date.weekday() in [5, 6]:
            current_date += timedelta(days=1)
            continue

        # Filter estimations for this date
        day_estimations = df_estimations.filter(
            pl.col("estimated_at").dt.date() == current_date
        )

        new_users = day_estimations["user_id"].unique().to_list()
        new_rooms = day_estimations["room_id"].unique().to_list()

        # Update last active date for users
        for user in new_users:
            last_active_user[user] = current_date
            if user not in users:
                users.add(user)
            elif user not in accounted_users:
                accounted_users.add(user)

        # Update last active date for rooms
        for room in new_rooms:
            last_active_room[room] = current_date
            if room not in rooms:
                rooms.add(room)
            elif room not in accounted_rooms:
                accounted_rooms.add(room)

        # Calculate reoccurring counts
        reoccurring_users = len(accounted_users)
        reoccurring_rooms = len(accounted_rooms)

        # Calculate adjusted (active within last 30 days)
        adjusted_reoccurring_users = sum(
            1 for user in accounted_users
            if (current_date - last_active_user[user]).days <= 30
        )
        adjusted_reoccurring_rooms = sum(
            1 for room in accounted_rooms
            if (current_date - last_active_room[room]).days <= 30
        )

        reoccurring.append({
            "date": current_date.isoformat(),
            "reoccurring_users": reoccurring_users,
            "reoccurring_rooms": reoccurring_rooms,
            "adjusted_reoccurring_users": adjusted_reoccurring_users,
            "adjusted_reoccurring_rooms": adjusted_reoccurring_rooms,
        })

        current_date += timedelta(days=1)

    return reoccurring
