import pandas as pd

from scripts.update_read_model import update_votes_read_model
from util.log_util import logger
from util.number_util import r


def calc_room_stats(room_id):
    # update votes read model
    try:
        update_votes_read_model()
    except Exception as e:
        logger.error("calc_room_stats -> update_votes_read_model failed", {"error": e})

    # find votes for room and filter by room_id
    votes = pd.read_parquet(f"./data/fpp_votes.parquet",
                            columns=["room_id", "avg_estimation", "max_estimation", "min_estimation",
                                     "amount_of_estimations", "duration", "amount_of_spectators"],
                            filters=[("room_id", "==", int(room_id))])

    # count of votes
    total_votes = len(votes)

    # average duration
    duration = r(votes['duration'].mean(), 0)

    # count of estimations
    estimations = int(votes['amount_of_estimations'].sum())

    # estimations per vote
    if total_votes == 0:
        estimations_per_vote = 0
    else:
        estimations_per_vote = r(estimations / total_votes)

    # average min estimation
    avg_min_estimation = r(votes['min_estimation'].mean())

    # average avg estimation
    avg_avg_estimation = r(votes['avg_estimation'].mean())

    # average max estimation
    avg_max_estimation = r(votes['max_estimation'].mean())

    # count of spectators
    spectators = int(votes['amount_of_spectators'].sum())

    # spectators per vote
    spectators_per_vote = r(spectators / total_votes)

    return {
        "votes": total_votes,
        "duration": duration,
        "estimations": estimations,
        "estimations_per_vote": estimations_per_vote,
        "avg_min_estimation": avg_min_estimation,
        "avg_avg_estimation": avg_avg_estimation,
        "avg_max_estimation": avg_max_estimation,
        "spectators": spectators,
        "spectators_per_vote": spectators_per_vote
    }
