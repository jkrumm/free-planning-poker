import os

import pandas as pd

from config import DATA_DIR


def calc_daily_analytics():
    # load votes data
    votes = pd.read_parquet(os.path.join(DATA_DIR, "fpp_votes.parquet"),
                            columns=["amount_of_estimations", "room_id"],
                            filters=[("voted_at", ">", pd.Timestamp.now() - pd.Timedelta(days=1))])

    # count of votes
    total_votes = len(votes)

    # count of estimations
    estimations = int(votes['amount_of_estimations'].sum())

    # amount of different rooms
    rooms = votes['room_id'].nunique()

    # load page view data with columns 'user_id' and 'viewed_at'
    page_views = pd.read_parquet(os.path.join(DATA_DIR, "fpp_page_views.parquet"), columns=["user_id", "viewed_at"],
                                 filters=[("viewed_at", ">", pd.Timestamp.now() - pd.Timedelta(days=1))])

    # count unique users
    unique_users = page_views["user_id"].nunique()

    # count total page views
    page_views = len(page_views)

    return {
        "votes": total_votes,
        "estimations": estimations,
        "rooms": rooms,
        "unique_users": unique_users,
        "page_views": page_views
    }
