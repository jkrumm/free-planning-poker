import os

import pandas as pd
import numpy as np

from config import DATA_DIR
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
    votes = pd.read_parquet(os.path.join(DATA_DIR, "fpp_votes.parquet"),
                            columns=["room_id", "avg_estimation", "max_estimation", "min_estimation",
                                     "amount_of_estimations", "duration", "amount_of_spectators"],
                            filters=[("room_id", "==", int(room_id))])

    # count of votes
    total_votes = len(votes)

    # average duration
    duration = r(votes['duration'].mean(), 0)
    if np.isnan(duration):
        duration = 0

    # count of estimations
    estimations = int(votes['amount_of_estimations'].sum())

    # estimations per vote
    if total_votes == 0:
        estimations_per_vote = 0
    else:
        estimations_per_vote = r(estimations / total_votes)
        if np.isnan(estimations_per_vote):
            estimations_per_vote = 0

    # average min estimation
    avg_min_estimation = r(votes['min_estimation'].mean())
    if np.isnan(avg_min_estimation):
        avg_min_estimation = 0

    # average avg estimation
    avg_avg_estimation = r(votes['avg_estimation'].mean())
    if np.isnan(avg_avg_estimation):
        avg_avg_estimation = 0

    # average max estimation
    avg_max_estimation = r(votes['max_estimation'].mean())
    if np.isnan(avg_max_estimation):
        avg_max_estimation = 0

    # count of spectators
    spectators = int(votes['amount_of_spectators'].sum())

    # spectators per vote
    spectators_per_vote = 0
    if total_votes > 0:
        spectators_per_vote = r(spectators / total_votes)
        if np.isnan(spectators_per_vote):
            spectators_per_vote = 0

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
