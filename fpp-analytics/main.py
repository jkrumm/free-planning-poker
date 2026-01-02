import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pythonjsonlogger import jsonlogger
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from config import ANALYTICS_SECRET_TOKEN, SENTRY_DSN, SENTRY_ENVIRONMENT
from routers import analytics, health, room
from util.sentry_wrapper import ErrorContext, capture_error


# Custom JSON formatter to match Pino structure
class PinoJsonFormatter(jsonlogger.JsonFormatter):
    """JSON formatter that outputs Pino-compatible log format."""

    def add_fields(
        self,
        log_record: dict[str, object],
        record: logging.LogRecord,
        message_dict: dict[str, object],
    ) -> None:
        super().add_fields(log_record, record, message_dict)
        # Map Python levels to Pino levels
        level_map = {
            "DEBUG": 20,  # Pino debug
            "INFO": 30,  # Pino info
            "WARNING": 40,  # Pino warn
            "ERROR": 50,  # Pino error
            "CRITICAL": 60,  # Pino fatal
        }
        log_record["level"] = level_map.get(record.levelname, 30)
        log_record["time"] = int(record.created * 1000)  # Pino uses ms timestamp
        # Use message if available, otherwise use a default based on context
        msg = log_record.pop("message", None)
        if not msg:
            # Generate message from available context
            msg = f"{log_record.get('component', 'unknown')}:{log_record.get('action', 'unknown')}"
        log_record["msg"] = msg
        log_record["service"] = "fpp-analytics"


# Configure JSON logging
handler = logging.StreamHandler()
formatter = PinoJsonFormatter("%(time)s %(level)s %(name)s %(msg)s")
handler.setFormatter(formatter)

# Configure root logger and uvicorn loggers
logging.basicConfig(
    level=logging.INFO,
    handlers=[handler],
)
logger = logging.getLogger("fpp-analytics")

# Disable Uvicorn's default access logger (we use custom middleware)
uvicorn_access_logger = logging.getLogger("uvicorn.access")
uvicorn_access_logger.disabled = True

# Configure Uvicorn error logger to use JSON format
uvicorn_error_logger = logging.getLogger("uvicorn.error")
uvicorn_error_logger.handlers = [handler]
uvicorn_error_logger.propagate = False

# Configure Uvicorn general logger to use JSON format
uvicorn_logger = logging.getLogger("uvicorn")
uvicorn_logger.handlers = [handler]
uvicorn_logger.propagate = False


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

        # Build structured log data as extra kwargs
        log_extra = {
            "component": "httpRequest",
            "action": request.url.path,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration": round(duration_ms, 2),
        }

        # Add path params if present
        if request.path_params:
            log_extra["pathParams"] = dict(request.path_params)

        # Add cache status for main analytics endpoint
        if request.url.path == "/" and "X-Cache" in response.headers:
            log_extra["cache"] = response.headers["X-Cache"]

        # Log message
        log_msg = f"{request.method} {request.url.path} {response.status_code}"

        # Use appropriate log level based on status code
        if response.status_code >= 500:
            logger.error(log_msg, extra=log_extra)
        elif response.status_code >= 400:
            logger.warning(log_msg, extra=log_extra)
        else:
            logger.info(log_msg, extra=log_extra)

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
