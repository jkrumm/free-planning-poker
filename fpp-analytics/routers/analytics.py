from fastapi import APIRouter, Response
from calculations.traffic import calc_traffic
from calculations.votes import calc_votes
from calculations.behaviour import calc_behaviour
from calculations.reoccurring import calc_reoccurring
from calculations.historical import calc_historical
from calculations.location import calc_location_and_user_agent
from calculations.daily import calc_daily_analytics
from util.http_client import send_daily_email
from util.cache import get_cached_response, set_cached_response

router = APIRouter()


@router.get("/")
async def get_analytics(response: Response):
    """Main analytics endpoint - cached, invalidated when Parquet files update."""
    cached, cache_hit, cache_ts = get_cached_response()

    response.headers["X-Cache"] = "HIT" if cache_hit else "MISS"

    if cached is not None:
        return {**cached, "data_updated_at": cache_ts}

    result = {
        "data": {
            "traffic": calc_traffic(),
            "votes": calc_votes(),
            "behaviour": calc_behaviour(),
            "reoccurring": calc_reoccurring(),
            "historical": calc_historical(),
            "location_and_user_agent": calc_location_and_user_agent(),
        }
    }
    if cache_ts is not None:
        set_cached_response(result, cache_ts)
    return {**result, "data_updated_at": cache_ts}


@router.get("/daily-analytics")
async def get_daily_analytics():
    """Calculate daily analytics and send email report."""
    daily = calc_daily_analytics()
    await send_daily_email(daily)
    return daily
