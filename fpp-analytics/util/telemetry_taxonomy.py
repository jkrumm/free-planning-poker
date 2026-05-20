"""Typed telemetry taxonomy for fpp-analytics.

Python can't import the TypeScript registry (`@fpp/shared/telemetry`), so this
is the hand-kept parallel of the small subset analytics actually emits — the
attribute keys and metric names. Keep names in sync with the TS source of truth;
analytics-only keys (`endpoint`) live here.

See docs/otel-migration/05-observability-v2.md §4-5/§10.
"""

from typing import Final


class ATTR:
    """Attribute keys. snake_case, domain-first; `fpp.*` for facade metadata."""

    ENDPOINT: Final = "endpoint"  # route template, e.g. /room/{room_id}/stats
    OUTCOME: Final = "outcome"  # ok | error
    ERROR_TYPE: Final = "error.type"  # bounded: HTTP status on the error path
    # Facade-proprietary cross-cutting metadata (mirrors the TS registry).
    FPP_COMPONENT: Final = "fpp.component"
    FPP_ACTION: Final = "fpp.action"
    FPP_SEVERITY: Final = "fpp.severity"


class METRIC:
    """Metric instrument names. dot-namespaced, instrument-suffixed, UCUM units."""

    REQUEST_COUNT: Final = "fpp.analytics.request.count"  # counter, {request}
    REQUEST_DURATION: Final = "fpp.analytics.request.duration"  # histogram, s
