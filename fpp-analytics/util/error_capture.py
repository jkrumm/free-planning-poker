"""Error / message / breadcrumb capture utilities backed by OpenTelemetry.

Drop-in replacement for the previous Sentry-based wrapper — same public API
(`capture_error`, `add_error_breadcrumb`, `ErrorContext`) so call sites in
routers and update_readmodel.py do not change.

Errors are recorded on the active OTEL span (if any), and a log record is
emitted with the same trace_id/span_id so HyperDX correlates them
automatically.
"""

import logging
from typing import Any, Literal

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

logger = logging.getLogger("fpp-analytics")

SeverityLevel = Literal["critical", "high", "medium", "low"]


_LOG_LEVEL: dict[SeverityLevel, int] = {
    "critical": logging.CRITICAL,
    "high": logging.ERROR,
    "medium": logging.WARNING,
    "low": logging.INFO,
}


class ErrorContext:
    """Structured context for error capture."""

    def __init__(
        self, component: str, action: str, extra: dict[str, Any] | None = None
    ) -> None:
        self.component = component
        self.action = action
        self.extra = extra or {}


def _flat_extra(extra: dict[str, Any]) -> dict[str, str]:
    return {f"fpp.{k}": str(v) for k, v in extra.items()}


def capture_error(
    error: Exception | str,
    context: ErrorContext,
    severity: SeverityLevel = "high",
) -> None:
    """Capture an exception or error message with structured context.

    Records on the active span (if any) and emits a log record. The
    Python-logging path handles terminal output via the existing
    PinoJsonFormatter handler.
    """
    error_msg = str(error) if isinstance(error, Exception) else error
    context_str = f"[{context.component}:{context.action}]"
    extra_str = f" {context.extra}" if context.extra else ""

    # Local logging — fires regardless of OTEL backend availability.
    logger.log(_LOG_LEVEL[severity], f"{context_str} {error_msg}{extra_str}")

    span = trace.get_current_span()
    if span.is_recording():
        # record_exception requires a BaseException — wrap strings.
        exc = error if isinstance(error, Exception) else Exception(error)
        span.record_exception(exc)
        span.set_status(Status(StatusCode.ERROR, error_msg))
        span.set_attribute("fpp.component", context.component)
        span.set_attribute("fpp.action", context.action)
        span.set_attribute("fpp.severity", severity)
        for k, v in _flat_extra(context.extra).items():
            span.set_attribute(k, v)


def add_error_breadcrumb(
    message: str,
    category: str,
    data: dict[str, Any] | None = None,
    level: Literal["debug", "info", "warning", "error"] = "info",
) -> None:
    """Emit an INFO log record correlated with the active trace.

    Replaces Sentry breadcrumbs — the log shows up alongside its trace in
    HyperDX, queryable by trace_id.
    """
    data_str = f" {data}" if data else ""
    log_msg = f"[{category}] {message}{data_str}"
    if level == "debug":
        logger.debug(log_msg)
    elif level == "warning":
        logger.warning(log_msg)
    elif level == "error":
        logger.error(log_msg)
    else:
        logger.info(log_msg)
