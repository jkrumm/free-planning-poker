import os

import pandas as pd

from config import DATA_DIR
from util.log_util import logger
from util.number_util import r


def calc_votes():
    # load votes data
    df_votes = pd.read_parquet(os.path.join(DATA_DIR, "fpp_votes.parquet"),
                               columns=["avg_estimation", "max_estimation", "min_estimation", "amount_of_estimations",
                                        "amount_of_spectators", "duration", "voted_at"])

    # count total votes
    total_votes = len(df_votes)

    # count total estimations
    total_estimations = int(df_votes["amount_of_estimations"].sum())

    # avg amount of estimations per vote
    avg_estimations_per_vote = r(total_estimations / total_votes)

    # avg amount of spectators per vote
    avg_spectators_per_vote = r(df_votes["amount_of_spectators"].mean())

    # avg duration per vote
    avg_duration_per_vote = r(df_votes["duration"].mean() / 60)

    # avg estimation
    avg_estimation = r(df_votes["avg_estimation"].mean())

    # avg min estimation
    avg_min_estimation = r(df_votes["min_estimation"].mean())

    # avg max estimation
    avg_max_estimation = r(df_votes["max_estimation"].mean())

    # count of votes on each week day
    df_votes["weekday"] = df_votes["voted_at"].dt.weekday
    weekday_counts = df_votes["weekday"].value_counts().sort_index().to_dict()
    weekday_counts = {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][k]: v for k, v in
                      weekday_counts.items()}

    # amount of each estimation value sorted increasingly
    df_estimations = pd.read_parquet(os.path.join(DATA_DIR, "fpp_estimations.parquet"), columns=["estimation"])
    estimation_counts = df_estimations["estimation"].value_counts().sort_index().to_dict()
    estimation_counts = {int(k): v for k, v in estimation_counts.items()}

    votes = {
        "total_votes": total_votes,
        "total_estimations": total_estimations,
        "avg_estimations_per_vote": avg_estimations_per_vote,
        "avg_spectators_per_vote": avg_spectators_per_vote,
        "avg_duration_per_vote": avg_duration_per_vote,
        "avg_estimation": avg_estimation,
        "avg_min_estimation": avg_min_estimation,
        "avg_max_estimation": avg_max_estimation,
        "weekday_counts": weekday_counts,
        "estimation_counts": estimation_counts
    }

    logger.debug("Votes calculated", votes)

    return votes
