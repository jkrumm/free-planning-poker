from typing import Any

from fastapi import APIRouter, Response

from calculations.behaviour import calc_behaviour
from calculations.daily import calc_daily_analytics
from calculations.historical import calc_historical
from calculations.location import calc_location_and_user_agent
from calculations.reoccurring import calc_reoccurring
from calculations.traffic import calc_traffic
from calculations.votes import calc_votes
from util.cache import get_cached_response, set_cached_response
from util.http_client import send_daily_email
from util.sentry_wrapper import ErrorContext, add_error_breadcrumb, capture_error

router = APIRouter()


@router.get("/")
async def get_analytics(response: Response) -> dict[str, Any]:
    """Main analytics endpoint - cached, invalidated when Parquet files update."""
    try:
        add_error_breadcrumb(
            message="Fetching analytics data",
            category="analytics",
            data={"endpoint": "get_analytics"},
        )

        cached, cache_hit, cache_ts = get_cached_response()
        response.headers["X-Cache"] = "HIT" if cache_hit else "MISS"

        if cached is not None:
            return {**cached, "data_updated_at": cache_ts}

        # Calculate all metrics
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

    except Exception as e:
        capture_error(
            e,
            ErrorContext(
                component="analytics_router",
                action="get_analytics",
                extra={"cache_hit": cache_hit if "cache_hit" in locals() else None},
            ),
            severity="high",
        )
        raise


@router.get("/daily-analytics")
async def get_daily_analytics() -> dict[str, Any]:
    """Calculate daily analytics and send email report."""
    try:
        add_error_breadcrumb(
            message="Calculating daily analytics",
            category="analytics",
            data={"endpoint": "get_daily_analytics"},
        )

        daily = calc_daily_analytics()

        add_error_breadcrumb(
            message="Sending daily email",
            category="email",
            data={"has_data": bool(daily)},
        )

        await send_daily_email(daily)

        return daily

    except Exception as e:
        capture_error(
            e,
            ErrorContext(
                component="analytics_router",
                action="get_daily_analytics",
                extra={},
            ),
            severity="high",
        )
        raise
