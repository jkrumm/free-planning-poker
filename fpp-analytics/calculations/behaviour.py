"""Behaviour analytics calculation using Polars."""

import re
from pathlib import Path
from typing import Any

import polars as pl

from config import DATA_DIR

TOP_N = 40


def extract_sources(
    sources: dict[str, int], sources_mapping: list[list[str]]
) -> dict[str, int]:
    """Extract and categorize sources based on regex patterns."""
    updated_sources: dict[str, int] = {}

    # Process each mapping
    for target, pattern in sources_mapping:
        for key in list(
            sources.keys()
        ):  # NOSONAR - list() required for safe dict mutation during iteration
            if re.search(pattern, key):
                if target in updated_sources:
                    updated_sources[target] += sources.pop(key)
                else:
                    updated_sources[target] = sources.pop(key)

    # Assign remaining items to "Other" category
    updated_sources["Other"] = sum(sources.values())
    return updated_sources


def calc_behaviour() -> dict[str, Any]:
    """Calculate behaviour analytics from Parquet files."""
    data_dir = Path(DATA_DIR)

    # Load page view data
    df_page_views = pl.read_parquet(
        data_dir / "fpp_page_views.parquet", columns=["route", "source", "room_id"]
    )

    # Amount of page views for each route
    routes = dict(df_page_views.group_by("route").len().sort("route").iter_rows())

    # Amount of each source (filter out nulls)
    sources_raw = dict(
        df_page_views.filter(pl.col("source").is_not_null())
        .group_by("source")
        .len()
        .iter_rows()
    )

    sources = extract_sources(
        sources_raw,
        [
            ["Teams", r"teams\."],
            ["Google Ads", r"ads\.|google_ads"],
            ["Google Search", r"www\.google\.com"],
            ["Free Planning Poker", r"free-planning-poker\.com"],
            ["CV", r"cv"],
            ["Email", r"email"],
            ["GitHub", r"github\.com"],
            ["Bing", r"bing\.com"],
        ],
    )

    # Load event data
    df_events = pl.read_parquet(data_dir / "fpp_events.parquet", columns=["event"])

    # Amount of events for each event
    events = dict(df_events.group_by("event").len().iter_rows())

    # Load vote and room data for room popularity
    df_votes = pl.read_parquet(data_dir / "fpp_votes.parquet", columns=["room_id"])

    df_rooms = pl.read_parquet(data_dir / "fpp_rooms.parquet")

    # Ensure id column exists for join
    if "id" not in df_rooms.columns:
        # If fpp_rooms uses index as id, reset it
        df_rooms = df_rooms.with_row_index("id")

    # Join votes and rooms
    df_votes_with_rooms = df_votes.join(
        df_rooms.select(["id", "name"]), left_on="room_id", right_on="id", how="left"
    )

    # Amount of votes for each room (top N by count)
    rooms = dict(
        df_votes_with_rooms.group_by("name")
        .len()
        .sort("len", descending=True)
        .head(TOP_N)
        .iter_rows()
    )

    return {"routes": routes, "sources": sources, "events": events, "rooms": rooms}
