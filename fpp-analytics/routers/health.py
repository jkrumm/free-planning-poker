from fastapi import APIRouter
from pathlib import Path
from config import DATA_DIR

router = APIRouter()

REQUIRED_FILES = [
    "fpp_estimations.parquet",
    "fpp_events.parquet",
    "fpp_page_views.parquet",
    "fpp_rooms.parquet",
    "fpp_users.parquet",
    "fpp_votes.parquet",
]


@router.get("/health")
async def health_check():
    """Health check endpoint - verifies Parquet files exist."""
    data_dir = Path(DATA_DIR)

    parquet_status = {
        f: (data_dir / f).exists()
        for f in REQUIRED_FILES
    }

    all_present = all(parquet_status.values())

    total_size = sum(
        (data_dir / f).stat().st_size
        for f in REQUIRED_FILES
        if (data_dir / f).exists()
    )

    return {
        "status": "ok" if all_present else "degraded",
        "components": {
            "parquet_files": {
                "status": "ok" if all_present else "error",
                "files": parquet_status,
            },
            "storage": {
                "status": "ok",
                "data_size_mb": round(total_size / (1024 * 1024), 2),
            }
        }
    }
