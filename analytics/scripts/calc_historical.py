import pandas as pd

from util.log_util import logger


def calc_historical():
    # load user data with columns 'created_at'
    df_users = pd.read_parquet("./data/fpp_users.parquet", columns=["created_at"])

    # load page view data with columns 'viewed_at'
    df_page_views = pd.read_parquet("./data/fpp_page_views.parquet", columns=["viewed_at"])

    # load estimation data with columns 'estimated_at'
    df_estimations = pd.read_parquet("./data/fpp_estimations.parquet", columns=["estimated_at"])

    # create a list of dates from 19th of January 2024 until today
    start_date = pd.to_datetime("2024-01-19")
    end_date = pd.to_datetime("today")
    date_range = pd.date_range(start_date, end_date)

    # create a list of dicts with the date and the amount of users, page views and estimations per date
    historical = []
    for date in date_range:
        # find the amount of users created on this date
        users = len(df_users[df_users["created_at"].dt.date == date.date()])

        # find the amount of page views on this date
        page_views = len(df_page_views[df_page_views["viewed_at"].dt.date == date.date()])

        # find the amount of estimations on this date
        estimations = len(df_estimations[df_estimations["estimated_at"].dt.date == date.date()])

        # parse the date to an iso date string (yyyy-mm-dd)
        date = date.date().isoformat()

        # add the date and the amount of users, page views and estimations to the list
        historical.append({
            "date": date,
            "users": users,
            "page_views": page_views,
            "estimations": estimations
        })

    logger.debug("Historical calculated", historical)

    return historical
