"""Simple file-based cache invalidation for analytics endpoint."""

from pathlib import Path
from typing import Any

from config import DATA_DIR
from util.error_capture import ErrorContext, capture_error

_cache: dict[str, Any] = {
    "response": None,
    "timestamp": None,
}


def get_current_timestamp() -> str | None:
    """Read the cache status timestamp from shared file."""
    cache_file = Path(DATA_DIR) / "cache_status.txt"
    try:
        if cache_file.exists():
            return cache_file.read_text().strip()
    except (OSError, UnicodeDecodeError) as e:  # PermissionError derives from OSError
        capture_error(
            e,
            ErrorContext(component="cache", action="get_current_timestamp"),
            severity="medium",
        )
    return None


def get_cached_response() -> tuple[dict[str, Any] | None, bool, str | None]:
    """Return (cached_response, cache_hit, timestamp). Response is None if stale/missing."""
    current_ts = get_current_timestamp()
    if current_ts is None:
        return None, False, None
    if _cache["timestamp"] == current_ts and _cache["response"] is not None:
        return _cache["response"], True, current_ts
    return None, False, current_ts


def set_cached_response(response: dict[str, Any], timestamp: str) -> None:
    """Cache the response with the given timestamp."""
    _cache["response"] = response
    _cache["timestamp"] = timestamp
