import os
import re

import pandas as pd

from config import DATA_DIR
from util.log_util import logger


def extract_sources(sources, sources_mapping):
    updated_sources = {}

    # Process each mapping
    for target, pattern in sources_mapping:
        for key in list(sources):
            if re.search(pattern, key):
                if target in updated_sources:
                    updated_sources[target] += sources.pop(key)
                else:
                    updated_sources[target] = sources.pop(key)

    # Assign remaining items to "Other" category
    updated_sources["Other"] = sum(sources.values())
    return updated_sources


def calc_behaviour():
    # load page view data with columns 'user_id' and 'route'
    df_page_views = pd.read_parquet(os.path.join(DATA_DIR, "fpp_page_views.parquet"),
                                    columns=["route", "source", "room_id"])

    # amount of page views for each route
    routes = df_page_views.groupby("route", observed=False).size().to_dict()

    # amount of each source
    sources = df_page_views.groupby("source", observed=False).size().to_dict()

    sources = extract_sources(sources, [
        ["Teams", "teams\."],
        ["Google Ads", "ads\.|google_ads"],
        ["Google Search", "www\.google\.com"],
        ["Free Planning Poker", "free-planning-poker\.com"],
        ["CV", "cv"],
        ["Email", "email"],
        ["GitHub", "github\.com"],
        ["Bing", "bing\.com"],
    ])

    # load event data with column 'event'
    df_events = pd.read_parquet(os.path.join(DATA_DIR, "fpp_events.parquet"), columns=["event"])

    # amount of events for each event
    events = df_events.groupby("event", observed=False).size().to_dict()

    # load vote data with column 'room_name'
    df_votes = pd.read_parquet(os.path.join(DATA_DIR, "fpp_votes.parquet"), columns=["room_id"])

    # load rooms data with columns 'id' and 'name'
    df_rooms = pd.read_parquet(os.path.join(DATA_DIR, "fpp_rooms.parquet"), columns=["id", "name"])

    # join votes and rooms data on df_votes.'room_id' and df_rooms.'id'
    df_votes = df_votes.join(df_rooms, on="room_id", how="left")

    # amount of votes for each room
    rooms = df_votes.groupby("name").size().to_dict()

    behaviour = {
        "routes": routes,
        "sources": sources,
        "events": events,
        "rooms": rooms
    }

    logger.debug("Behaviour calculated", behaviour)

    return behaviour
