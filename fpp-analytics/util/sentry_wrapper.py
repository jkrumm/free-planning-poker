"""Sentry error capture utilities matching Next.js/fpp-server patterns."""

import logging
import os
from typing import Any, Literal

import sentry_sdk
from sentry_sdk import add_breadcrumb, capture_exception, capture_message

logger = logging.getLogger("fpp-analytics")

SeverityLevel = Literal["critical", "high", "medium", "low"]
SentrySeverityLevel = Literal["fatal", "critical", "error", "warning", "info", "debug"]

# Only send to Sentry in production
SENTRY_ENVIRONMENT = os.getenv("SENTRY_ENVIRONMENT", "development")
SEND_TO_SENTRY = SENTRY_ENVIRONMENT == "production"


def _map_severity_to_sentry(severity: SeverityLevel) -> SentrySeverityLevel:
    """Map custom severity levels to Sentry's expected levels.

    Mapping:
    - critical -> fatal
    - high -> error
    - medium -> warning
    - low -> info
    """
    mapping: dict[SeverityLevel, SentrySeverityLevel] = {
        "critical": "fatal",
        "high": "error",
        "medium": "warning",
        "low": "info",
    }
    return mapping[severity]


def _map_severity_to_logging(severity: SeverityLevel) -> int:
    """Map custom severity levels to Python logging levels."""
    mapping: dict[SeverityLevel, int] = {
        "critical": logging.CRITICAL,
        "high": logging.ERROR,
        "medium": logging.WARNING,
        "low": logging.INFO,
    }
    return mapping[severity]


class ErrorContext:
    """Structured context for error capture."""

    def __init__(
        self, component: str, action: str, extra: dict[str, Any] | None = None
    ) -> None:
        """Initialize error context.

        Args:
            component: Component/module name (e.g., "analytics_router", "update_readmodel")
            action: Action/function name (e.g., "get_analytics", "sync_table")
            extra: Additional context data (e.g., {"room_id": 123, "metric": "traffic"})
        """
        self.component = component
        self.action = action
        self.extra = extra or {}


def capture_error(
    error: Exception | str,
    context: ErrorContext,
    severity: SeverityLevel = "high",
) -> None:
    """Capture error with structured context.

    Always logs to Python logging. Only sends to Sentry in production.

    Args:
        error: Exception instance or error message string
        context: Structured context (component, action, extra data)
        severity: Error severity level (critical|high|medium|low)

    Example:
        ```python
        try:
            result = await calculate_metrics(room_id)
        except Exception as e:
            capture_error(
                e,
                ErrorContext(
                    component="analytics_router",
                    action="get_analytics",
                    extra={"room_id": room_id}
                ),
                severity="high"
            )
            raise
        ```
    """
    # Format error message for logging
    error_msg = str(error) if isinstance(error, Exception) else error
    context_str = f"[{context.component}:{context.action}]"

    # Always log locally (development and production)
    log_level = _map_severity_to_logging(severity)
    extra_str = f" {context.extra}" if context.extra else ""
    logger.log(log_level, f"{context_str} {error_msg}{extra_str}")

    # Only send to Sentry in production
    if not SEND_TO_SENTRY:
        return

    with sentry_sdk.push_scope() as scope:
        # Set tags for filtering in Sentry
        scope.set_tag("component", context.component)
        scope.set_tag("action", context.action)

        # Add structured context data
        scope.set_context(
            "error_context",
            {
                "component": context.component,
                "action": context.action,
                **context.extra,
            },
        )

        # Map and set severity level
        sentry_level = _map_severity_to_sentry(severity)
        scope.level = sentry_level

        # Capture to Sentry
        if isinstance(error, Exception):
            capture_exception(error)
        else:
            capture_message(error, level=sentry_level)


def add_error_breadcrumb(
    message: str,
    category: str,
    data: dict[str, Any] | None = None,
    level: Literal["debug", "info", "warning", "error"] = "info",
) -> None:
    """Add breadcrumb for error tracking.

    Always logs to Python logging (DEBUG level). Only sends to Sentry in production.

    Args:
        message: Breadcrumb message (e.g., "Starting metrics calculation")
        category: Category for grouping (e.g., "database", "calculation", "http")
        data: Additional data (e.g., {"metric": "traffic", "date_range": "7d"})
        level: Severity level (debug|info|warning|error)

    Example:
        ```python
        add_error_breadcrumb(
            message="Fetching traffic data",
            category="calculation",
            data={"metric": "traffic", "days": 7}
        )
        ```
    """
    # Always log breadcrumbs locally at DEBUG level
    data_str = f" {data}" if data else ""
    logger.debug(f"[{category}] {message}{data_str}")

    # Only send breadcrumbs to Sentry in production
    if SEND_TO_SENTRY:
        add_breadcrumb(message=message, category=category, data=data or {}, level=level)
