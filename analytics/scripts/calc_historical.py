import os

import pandas as pd

from config import DATA_DIR, START_DATE
from util.log_util import logger
from util.number_util import r


def calc_historical():
    # Load data
    df_users = pd.read_parquet(os.path.join(DATA_DIR, "fpp_users.parquet"), columns=["created_at"])
    df_page_views = pd.read_parquet(os.path.join(DATA_DIR, "fpp_page_views.parquet"), columns=["viewed_at"])
    df_rooms = pd.read_parquet(os.path.join(DATA_DIR, "fpp_rooms.parquet"), columns=["first_used_at"])
    df_estimations = pd.read_parquet(os.path.join(DATA_DIR, "fpp_estimations.parquet"), columns=["estimated_at"])
    df_votes = pd.read_parquet(os.path.join(DATA_DIR, "fpp_votes.parquet"), columns=["voted_at"])

    # create a list of dates from START_DATE until today
    start_date = pd.to_datetime(START_DATE)
    end_date = pd.to_datetime("today")
    date_range = pd.date_range(start_date, end_date)

    # create a list of dicts with the date and the amount of users, page views and estimations per date
    historical = []
    last_new_users = 0
    last_page_views = 0
    last_rooms = 0
    last_estimations = 0
    last_votes = 0

    for date in date_range:
        # ignore saturday and sunday
        if date.weekday() in [5, 6]:
            continue

        # find the amount of users created on this date
        new_users = len(df_users[df_users["created_at"].dt.date == date.date()])
        acc_new_users = new_users + last_new_users
        last_new_users = acc_new_users

        # find the amount of page views on this date
        page_views = len(df_page_views[df_page_views["viewed_at"].dt.date == date.date()])
        acc_page_views = page_views + last_page_views
        last_page_views = acc_page_views

        # find the amount of rooms created on this date
        rooms = len(df_rooms[df_rooms["first_used_at"].dt.date == date.date()])
        acc_rooms = rooms + last_rooms
        last_rooms = acc_rooms

        # find the amount of estimations on this date
        estimations = len(df_estimations[df_estimations["estimated_at"].dt.date == date.date()])
        acc_estimations = estimations + last_estimations
        last_estimations = acc_estimations

        # find the amount of votes on this date
        votes = len(df_votes[df_votes["voted_at"].dt.date == date.date()])
        acc_votes = votes + last_votes
        last_votes = acc_votes

        # parse the date to an iso date string (yyyy-mm-dd)
        date = date.date().isoformat()

        # add the date and the amount of users, page views and estimations to the list
        historical.append({
            "date": date,
            "new_users": new_users,
            "acc_new_users": acc_new_users,
            "page_views": page_views,
            "acc_page_views": acc_page_views,
            "rooms": rooms,
            "acc_rooms": acc_rooms,
            "estimations": estimations,
            "acc_estimations": acc_estimations,
            "votes": votes,
            "acc_votes": acc_votes
        })

    # Convert historical data to DataFrame
    df_historical = pd.DataFrame(historical)

    # Calculate moving averages
    window_size = 30  # Weekly moving average
    df_historical['ma_new_users'] = df_historical['new_users'].rolling(window=window_size).mean()
    df_historical['ma_page_views'] = df_historical['page_views'].rolling(window=window_size).mean()
    df_historical['ma_votes'] = df_historical['votes'].rolling(window=window_size).mean()
    df_historical['ma_rooms'] = df_historical['rooms'].rolling(window=window_size).mean()
    df_historical['ma_estimations'] = df_historical['estimations'].rolling(window=window_size).mean()

    # Update historical entries with moving averages
    for i, row in df_historical.iterrows():
        historical[i].update({
            "ma_new_users": r(row['ma_new_users']) if not pd.isna(row['ma_new_users']) else None,
            "ma_page_views": r(row['ma_page_views']) if not pd.isna(row['ma_page_views']) else None,
            "ma_votes": r(row['ma_votes']) if not pd.isna(row['ma_votes']) else None,
            "ma_rooms": r(row['ma_rooms']) if not pd.isna(row['ma_rooms']) else None,
            "ma_estimations": r(row['ma_estimations']) if not pd.isna(row['ma_estimations']) else None
        })

    logger.debug("Historical calculated", historical[-5:])

    return historical
