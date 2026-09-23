import os
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

# Data storage
DATA_DIR = os.getenv("DATA_DIR", "./data")

# Database (direct connection, same docker network)
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "mariadb"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USERNAME", "fpp"),
    "password": os.getenv("DB_PASSWORD"),
    "database": "free-planning-poker",
    "charset": "utf8mb4",
    "use_pure": True,
}

# Authentication
ANALYTICS_SECRET_TOKEN = os.getenv("ANALYTICS_SECRET_TOKEN")


def _normalize_base_url(raw: str | None) -> str | None:
    """Normalize an env-provided base URL: add a default scheme when the
    value is a bare host (e.g. `bea.example.com`), then validate it.

    httpx raises `UnsupportedProtocol` for a scheme-less URL, which surfaces
    as a 500 on every endpoint that calls out to it — fail fast here instead,
    at config load, with a clear error pointing at the offending value.
    """
    if not raw:
        return raw

    candidate = raw if "://" in raw else f"https://{raw}"
    parsed = urlparse(candidate)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError(
            f"BEA_BASE_URL is not a valid http(s) URL: {raw!r}. "
            "Expected a full URL with scheme, e.g. https://bea.example.com"
        )
    return candidate


# Email service
BEA_BASE_URL = _normalize_base_url(os.getenv("BEA_BASE_URL"))
BEA_SECRET_KEY = os.getenv("BEA_SECRET_KEY")

# Monitoring
UPTIMEKUMA_PUSH_URL = os.getenv("UPTIMEKUMA_PUSH_URL")

# Analytics constants
START_DATE = "2024-06-03"
