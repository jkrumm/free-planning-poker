"""Simple file-based cache invalidation for analytics endpoint."""
from pathlib import Path
from typing import Any

import sentry_sdk

from config import DATA_DIR

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
    except (OSError, PermissionError, UnicodeDecodeError) as e:
        sentry_sdk.capture_exception(e)
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
