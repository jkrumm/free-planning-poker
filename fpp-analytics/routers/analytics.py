from fastapi import APIRouter
from calculations.traffic import calc_traffic
from calculations.votes import calc_votes
from calculations.behaviour import calc_behaviour
from calculations.reoccurring import calc_reoccurring
from calculations.historical import calc_historical
from calculations.location import calc_location_and_user_agent
from calculations.daily import calc_daily_analytics
from util.http_client import send_daily_email

router = APIRouter()


@router.get("/")
async def get_analytics():
    """Main analytics endpoint - calculates on-demand from Parquet files."""
    return {
        "data": {
            "traffic": calc_traffic(),
            "votes": calc_votes(),
            "behaviour": calc_behaviour(),
            "reoccurring": calc_reoccurring(),
            "historical": calc_historical(),
            "location_and_user_agent": calc_location_and_user_agent(),
        }
    }


@router.get("/daily-analytics")
async def get_daily_analytics():
    """Calculate daily analytics and send email report."""
    daily = calc_daily_analytics()
    await send_daily_email(daily)
    return daily
