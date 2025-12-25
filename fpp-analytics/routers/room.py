from fastapi import APIRouter
from calculations.room_stats import calc_room_stats

router = APIRouter()


@router.get("/{room_id}/stats")
async def get_room_stats(room_id: int):
    """Get statistics for a specific room."""
    return calc_room_stats(room_id)
