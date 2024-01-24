import pandas as pd

from util.log_util import logger


def calc_behaviour():
    # load page view data with columns 'user_id' and 'route'
    df_page_views = pd.read_parquet("./data/fpp_page_views.parquet", columns=["route", "room_id"])

    # amount of page views for each route
    routes = df_page_views.groupby("route", observed=False).size().to_dict()

    # load event data with column 'event'
    df_events = pd.read_parquet("./data/fpp_events.parquet", columns=["event"])

    # amount of events for each event
    events = df_events.groupby("event", observed=False).size().to_dict()

    # load vote data with column 'room_name'
    df_votes = pd.read_parquet("./data/fpp_votes.parquet", columns=["room_id"])

    # load rooms data with columns 'id' and 'name'
    df_rooms = pd.read_parquet("./data/fpp_rooms.parquet", columns=["id", "name"])

    # join votes and rooms data on df_votes.'room_id' and df_rooms.'id'
    df_votes = df_votes.join(df_rooms, on="room_id", how="left")

    # amount of votes for each room
    rooms = df_votes.groupby("name").size().to_dict()

    behaviour = {
        "routes": routes,
        "events": events,
        "rooms": rooms
    }

    logger.debug("Behaviour calculated", behaviour)

    return behaviour
