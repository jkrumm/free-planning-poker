from typing import Any

from fastapi import APIRouter, HTTPException

from calculations.room_stats import calc_room_stats
from util.sentry_wrapper import ErrorContext, add_error_breadcrumb, capture_error

router = APIRouter()


@router.get("/{room_id}/stats")
async def get_room_stats(room_id: int) -> dict[str, Any]:
    """Get statistics for a specific room."""
    # Validate room_id
    if room_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid room_id")

    try:
        add_error_breadcrumb(
            message="Fetching room statistics",
            category="analytics",
            data={"room_id": room_id},
        )

        return calc_room_stats(room_id)

    except Exception as e:
        capture_error(
            e,
            ErrorContext(
                component="room_router",
                action="get_room_stats",
                extra={"room_id": room_id},
            ),
            severity="high",
        )
        raise
