import pandas as pd

from util.log_util import logger
from util.number_util import r


def calc_votes():
    # load votes data
    df_votes = pd.read_parquet("./data/fpp_votes.parquet",
                               columns=["avg_estimation", "max_estimation", "min_estimation", "amount_of_estimations",
                                        "amount_of_spectators", "duration"])

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

    votes = {
        "total_votes": total_votes,
        "total_estimations": total_estimations,
        "avg_estimations_per_vote": avg_estimations_per_vote,
        "avg_spectators_per_vote": avg_spectators_per_vote,
        "avg_duration_per_vote": avg_duration_per_vote,
        "avg_estimation": avg_estimation,
        "avg_min_estimation": avg_min_estimation,
        "avg_max_estimation": avg_max_estimation
    }

    logger.debug("Votes calculated", votes)

    return votes
