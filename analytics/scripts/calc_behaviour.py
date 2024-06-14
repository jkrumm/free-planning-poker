import os

import pandas as pd

from config import DATA_DIR
from util.log_util import logger


def calc_behaviour():
    # load page view data with columns 'user_id' and 'route'
    df_page_views = pd.read_parquet(os.path.join(DATA_DIR, "fpp_page_views.parquet"),
                                    columns=["route", "source", "room_id"])

    # amount of page views for each route
    routes = df_page_views.groupby("route", observed=False).size().to_dict()

    # amount of each source
    sources = df_page_views.groupby("source", observed=False).size().to_dict()
    if "cv" in sources:
        sources["CV"] = sources.pop("cv")
    if "https://www.google.com/" in sources:
        sources["Google Search"] = sources.pop("https://www.google.com/")
    if "google_ads" in sources:
        sources["Google Ads"] = sources.pop("google_ads")
    if "https://ads.google.com/" in sources:
        sources["Google Ads"] = sources.pop("https://ads.google.com/")
    if "email" in sources:
        sources["Email"] = sources.pop("email")
    if "https://statics.teams.cdn.office.net/" in sources:
        sources["Teams"] = sources.pop("https://statics.teams.cdn.office.net/")
    if "https://teams.microsoft.com/" in sources:
        sources["Teams"] = sources.pop("https://teams.microsoft.com/")
    if "https://www.bing.com/" in sources:
        sources["Bing"] = sources.pop("https://www.bing.com/")

    # sum all other sources into 'Other' and remove them from the dict
    sources["Other"] = sum(
        [v for k, v in sources.items() if k not in ["CV", "Google Search", "Google Ads", "Email", "Teams", "Bing"]])
    sources = {k: v for k, v in sources.items() if
               k in ["CV", "Google Search", "Google Ads", "Email", "Teams", "Bing", "Other"]}

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
