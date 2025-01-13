import os

import pandas as pd

from config import DATA_DIR, START_DATE
from util.log_util import logger
from util.number_util import r


def calc_reoccurring():
    # Load data
    df_estimations = pd.read_parquet(os.path.join(DATA_DIR, "fpp_estimations.parquet"),
                                     columns=["user_id", "room_id", "estimated_at"])

    # create a list of dates from START_DATE until today
    start_date = pd.to_datetime(START_DATE)
    end_date = pd.to_datetime("today")
    date_range = pd.date_range(start_date, end_date)

    # create a list of dicts with the date and the amount of reoccurring users and rooms
    reoccurring = []
    last_reoccurring_users = 0
    last_reoccurring_rooms = 0

    users = set()
    accounted_users = set()
    rooms = set()
    accounted_rooms = set()

    for date in date_range:
        # ignore saturday and sunday
        if date.weekday() in [5, 6]:
            continue

        new_users = df_estimations[df_estimations["estimated_at"].dt.date == date.date()]["user_id"].unique()
        for user in new_users:
            if user not in users:
                users.add(user)
            elif user not in accounted_users:
                last_reoccurring_users += 1
                accounted_users.add(user)

        new_rooms = df_estimations[df_estimations["estimated_at"].dt.date == date.date()]["room_id"].unique()
        for room in new_rooms:
            if room not in rooms:
                rooms.add(room)
            elif room not in accounted_rooms:
                last_reoccurring_rooms += 1
                accounted_rooms.add(room)

        # parse the date to an iso date string (yyyy-mm-dd)
        date = date.date().isoformat()

        # add the date and the amount of users, page views and estimations to the list
        reoccurring.append({
            "date": date,
            "reoccurring_users": last_reoccurring_users,
            "reoccurring_rooms": last_reoccurring_rooms,
        })

    logger.debug("Reoccurring calculated", reoccurring[-5:])

    return reoccurring
