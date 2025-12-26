import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Header, Request
from starlette.middleware.base import BaseHTTPMiddleware
import sentry_sdk

from routers import analytics, room, health
from config import SENTRY_DSN, SENTRY_ENVIRONMENT, ANALYTICS_SECRET_TOKEN

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("fpp-analytics")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Custom request logging with duration, path params, and cache status."""

    async def dispatch(self, request: Request, call_next):
        start_time = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Skip logging for /health 200 OK responses
        if request.url.path == "/health" and response.status_code == 200:
            return response

        # Build log message with path params
        path_params = request.path_params
        params_str = ""
        if path_params:
            params_str = " | " + " ".join(f"{k}={v}" for k, v in path_params.items())

        # Add cache status for main analytics endpoint
        cache_str = ""
        if request.url.path == "/" and "X-Cache" in response.headers:
            cache_str = f" | cache={response.headers['X-Cache']}"

        logger.info(
            f"{request.method} {request.url.path} | "
            f"{response.status_code} | "
            f"{duration_ms:.0f}ms{params_str}{cache_str}"
        )

        return response


def verify_auth(authorization: str = Header(None)):
    """Verify Bearer token authentication."""
    if not ANALYTICS_SECRET_TOKEN:
        raise HTTPException(status_code=500, detail="Auth not configured")
    if not authorization or authorization != ANALYTICS_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Sentry
    if SENTRY_DSN:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=SENTRY_ENVIRONMENT,
            traces_sample_rate=0.1,
            profiles_sample_rate=0.1,
            # Filter out health check transactions
            before_send_transaction=lambda event, hint: (
                None if event.get("transaction") == "/health" else event
            ),
        )
    yield
    # Shutdown: cleanup if needed


app = FastAPI(
    title="FPP Analytics API",
    version="2.0.0",
    lifespan=lifespan,
)

# Custom request logging (replaces uvicorn access log)
app.add_middleware(RequestLoggingMiddleware)

# Public health check (no auth)
app.include_router(health.router)

# Authenticated analytics routes
app.include_router(
    analytics.router,
    dependencies=[Depends(verify_auth)]
)
app.include_router(
    room.router,
    prefix="/room",
    dependencies=[Depends(verify_auth)]
)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5100, access_log=False)
