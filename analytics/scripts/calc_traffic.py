import os

import pandas as pd

from config import DATA_DIR
from util.log_util import logger
from util.number_util import r


def calc_traffic():
    # load page view data with columns 'user_id' and 'viewed_at'
    df_page_views = pd.read_parquet(os.path.join(DATA_DIR, "fpp_page_views.parquet"), columns=["user_id", "viewed_at"])

    # rename 'viewed_at' to 'activity_at'
    df_page_views.rename(columns={"viewed_at": "activity_at"}, inplace=True)

    # count unique users
    unique_users = df_page_views["user_id"].nunique()

    # count total page views
    page_views = len(df_page_views)

    # BOUNCE RATE
    # load estimation data with columns 'user_id' and 'estimated_at'
    df_estimations = pd.read_parquet(os.path.join(DATA_DIR, "fpp_estimations.parquet"), columns=["user_id", "estimated_at"])
    # rename 'viewed_at' to 'activity_at'
    df_estimations.rename(columns={"estimated_at": "activity_at"}, inplace=True)

    # calculate bounce rate by counting unique users who did not estimate and dividing by unique users
    bounce_rate = r(1 - (df_estimations["user_id"].nunique() / unique_users))

    # DURATION

    # Step 1: Join data
    df_joined = pd.concat([df_page_views, df_estimations])

    # Step 2: Sort data
    df_joined.sort_values(by=["user_id", "activity_at"], inplace=True)

    # Step 3: Reset index
    df_joined.reset_index(inplace=True, drop=True)

    # Step 4: Calculate time difference between each row and the previous row
    df_joined["time_diff"] = df_joined["activity_at"].diff()

    # Step 5: Calculate if we need to start a new session
    # A new session starts if the time difference is more than 10 minutes or if the user_id is different
    df_joined["new_session"] = (df_joined["time_diff"] > pd.Timedelta(minutes=10)) | \
                               (df_joined["user_id"] != df_joined["user_id"].shift(1))

    # Step 6: Calculate session number
    df_joined["session"] = df_joined["new_session"].cumsum()

    # Step 7: Calculate duration of each session
    df_joined['session_start'] = df_joined.groupby('session')['activity_at'].transform('min')
    df_joined['session_end'] = df_joined.groupby('session')['activity_at'].transform('max')
    df_joined['session_duration'] = df_joined['session_end'] - df_joined['session_start']

    # Step 8: Add 10 seconds to the duration of each session
    df_joined["adjusted_duration"] = df_joined["session_duration"] + pd.Timedelta(seconds=10)

    # Step 9: Ensure each session is counted once
    unique_sessions = df_joined.drop_duplicates(subset='session')

    # Step 10: Calculate average duration of each session in minutes
    average_duration = r(unique_sessions['adjusted_duration'].mean().total_seconds() / 60)

    traffic = {
        "unique_users": unique_users,
        "page_views": page_views,
        "bounce_rate": bounce_rate,
        "average_duration": average_duration
    }

    logger.debug("Traffic calculated", traffic)

    return traffic
