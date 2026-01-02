import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from config import ANALYTICS_SECRET_TOKEN, SENTRY_DSN, SENTRY_ENVIRONMENT
from routers import analytics, health, room
from util.sentry_wrapper import ErrorContext, capture_error

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("fpp-analytics")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Custom request logging with duration, path params, and cache status."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
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


def verify_auth(authorization: str = Header(None)) -> bool:
    """Verify Bearer token authentication."""
    if not ANALYTICS_SECRET_TOKEN:
        raise HTTPException(status_code=500, detail="Auth not configured")
    if not authorization or authorization != ANALYTICS_SECRET_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Startup: Initialize Sentry
    if SENTRY_DSN:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=SENTRY_ENVIRONMENT,
            traces_sample_rate=0.1,
            profiles_sample_rate=0.1,
            integrations=[
                FastApiIntegration(
                    transaction_style="endpoint",
                    failed_request_status_codes=[500, 599],
                ),
                StarletteIntegration(),
            ],
            # Filter out health check transactions
            before_send_transaction=lambda event, _hint: (
                None if event.get("transaction") == "/health" else event
            ),
        )
    yield
    # Shutdown: Flush Sentry events
    if SENTRY_DSN:
        sentry_sdk.flush(timeout=2.0)


app = FastAPI(
    title="FPP Analytics API",
    version="2.0.0",
    lifespan=lifespan,
)


# Global exception handler for unhandled system errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Capture unexpected system errors in Sentry.

    Note: HTTPException bypasses this handler (business logic errors are not captured).
    """
    # Capture in Sentry with request context
    capture_error(
        exc,
        ErrorContext(
            component="global_handler",
            action=f"{request.method} {request.url.path}",
            extra={
                "path": request.url.path,
                "method": request.method,
                "query_params": dict(request.query_params),
            },
        ),
        severity="critical",
    )

    # Return safe error response
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# Custom request logging (replaces uvicorn access log)
app.add_middleware(RequestLoggingMiddleware)

# Public health check (no auth)
app.include_router(health.router)

# Authenticated analytics routes
app.include_router(analytics.router, dependencies=[Depends(verify_auth)])
app.include_router(room.router, prefix="/room", dependencies=[Depends(verify_auth)])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5100, access_log=False)
