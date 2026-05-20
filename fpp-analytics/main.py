import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import JSONResponse
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from pythonjsonlogger import jsonlogger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from config import ANALYTICS_SECRET_TOKEN
from routers import analytics, health, room
from util.error_capture import ErrorContext, capture_error
from util.telemetry import init_telemetry, record_request, shutdown_telemetry


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

        # Endpoint RED metrics. Use the route template (not the raw path) as the
        # endpoint label so /room/{room_id}/stats stays one low-cardinality
        # series. Skip /health — high-frequency probe, excluded from spans too.
        if request.url.path != "/health":
            route = request.scope.get("route")
            endpoint = getattr(route, "path", None) or "unmatched"
            record_request(endpoint, response.status_code, duration_ms / 1000)

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


# Telemetry providers — initialized at module import (BEFORE the first
# request arrives) because FastAPIInstrumentor.instrument_app() injects
# middleware via Starlette's stack, which is built once per app and must
# be populated before the app starts handling requests. Doing this inside
# `lifespan` is too late — the middleware stack has already been frozen
# and the instrumentor's middleware silently never runs.
_tracer_provider, _logger_provider, _meter_provider = init_telemetry()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Flush OTEL batches on shutdown. Provider init happens at import time."""
    yield
    shutdown_telemetry(_tracer_provider, _logger_provider, _meter_provider)


# Global exception handler for unhandled system errors.
# starlette 1.0 removed the @app.exception_handler decorator — handlers must
# be passed via the FastAPI(exception_handlers=...) constructor argument.
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Capture unexpected system errors via OTEL.

    Note: HTTPException bypasses this handler (business logic errors are not captured).
    """
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

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


app = FastAPI(
    title="FPP Analytics API",
    version="2.0.0",
    lifespan=lifespan,
    exception_handlers={Exception: global_exception_handler},
)


# Custom request logging (replaces uvicorn access log). Added FIRST so OTel's
# middleware ends up outermost — our log records emit inside the active span
# and get correlated by trace_id automatically.
app.add_middleware(RequestLoggingMiddleware)

# FastAPI auto-instrumentation. Adds the OTel middleware to the app stack
# at import time so it's in place before the first request. excluded_urls
# is a comma-separated substring match — skips /health and any future
# /metrics endpoint from creating spans (high-frequency probes only).
FastAPIInstrumentor.instrument_app(app, excluded_urls="health,metrics")

# Public health check (no auth)
app.include_router(health.router)

# Authenticated analytics routes
app.include_router(analytics.router, dependencies=[Depends(verify_auth)])
app.include_router(room.router, prefix="/room", dependencies=[Depends(verify_auth)])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5100, access_log=False)
