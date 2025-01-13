import os
import pandas as pd
from config import DATA_DIR, START_DATE
from util.log_util import logger
from util.number_util import r

def calc_reoccurring():
    # Load data
    df_estimations = pd.read_parquet(
        os.path.join(DATA_DIR, "fpp_estimations.parquet"),
        columns=["user_id", "room_id", "estimated_at"]
    )

    # Create a list of dates from START_DATE until today
    start_date = pd.to_datetime(START_DATE)
    end_date = pd.to_datetime("today")
    date_range = pd.date_range(start_date, end_date)

    # Create a list of dicts with the date and the amount of reoccurring users and rooms
    reoccurring = []
    users = set()
    rooms = set()
    accounted_users = set()
    accounted_rooms = set()

    last_active_user = {}
    last_active_room = {}

    for date in date_range:
        # Ignore Saturday and Sunday
        if date.weekday() in [5, 6]:
            continue

        new_users = df_estimations[df_estimations["estimated_at"].dt.date == date.date()]["user_id"].unique()
        new_rooms = df_estimations[df_estimations["estimated_at"].dt.date == date.date()]["room_id"].unique()

        # Update last active date for users
        for user in new_users:
            last_active_user[user] = date
            if user not in users:
                users.add(user)
            elif user not in accounted_users:
                accounted_users.add(user)

        # Update last active date for rooms
        for room in new_rooms:
            last_active_room[room] = date
            if room not in rooms:
                rooms.add(room)
            elif room not in accounted_rooms:
                accounted_rooms.add(room)

        # Calculate reoccurring users and rooms
        # These should only increase as more users and rooms become reoccurring
        reoccurring_users = len(accounted_users)
        reoccurring_rooms = len(accounted_rooms)

        # Calculate adjusted reoccurring users and rooms
        adjusted_reoccurring_users = sum(
            1 for user in accounted_users
            if (date - last_active_user[user]).days <= 30
        )
        adjusted_reoccurring_rooms = sum(
            1 for room in accounted_rooms
            if (date - last_active_room[room]).days <= 30
        )

        # Parse the date to an ISO date string (yyyy-mm-dd)
        date = date.date().isoformat()

        # Add the date and the amount of users, page views, and estimations to the list
        reoccurring.append({
            "date": date,
            "reoccurring_users": reoccurring_users,
            "reoccurring_rooms": reoccurring_rooms,
            "adjusted_reoccurring_users": adjusted_reoccurring_users,
            "adjusted_reoccurring_rooms": adjusted_reoccurring_rooms,
        })

    logger.debug("Reoccurring calculated", reoccurring[-5:])

    return reoccurring
