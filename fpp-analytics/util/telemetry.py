"""OpenTelemetry bootstrap for fpp-analytics.

Mirrors the Argo / fpp-server pattern: pure OTEL SDK, OTLP HTTP/protobuf
exporter pointed at the unauthed :4319 receiver on the ClickStack
monitoring-net bridge in prod and at localhost:4319 in dev.
"""

import contextlib
import logging
import os

from opentelemetry import metrics as metrics_api
from opentelemetry import trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import (
    OTLPMetricExporter,
)
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter,
)
from opentelemetry.metrics import Counter, Histogram
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from util.telemetry_taxonomy import ATTR, METRIC

SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "fpp-analytics")
SERVICE_VERSION = os.getenv("OTEL_SERVICE_VERSION", "local")
ENVIRONMENT = os.getenv(
    "OTEL_DEPLOYMENT_ENVIRONMENT", os.getenv("NODE_ENV", "development")
)

# OTLP HTTP base — exporter appends /v1/traces and /v1/logs at request time.
# The gRPC port :4317 is authed in prod; we use the unauthed HTTP :4319
# receiver to stay consistent with fpp-server and Argo.
OTLP_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4319")

_resource = Resource.create(
    {
        "service.name": SERVICE_NAME,
        # Groups the three fpp services as one app in HyperDX.
        "service.namespace": "free-planning-poker",
        "service.version": SERVICE_VERSION,
        "deployment.environment": ENVIRONMENT,
    }
)


_initialized: tuple[TracerProvider, LoggerProvider, MeterProvider] | None = None

# Endpoint RED instruments, created once in init_telemetry. None until then.
_request_count: Counter | None = None
_request_duration: Histogram | None = None


def init_telemetry() -> tuple[TracerProvider, LoggerProvider, MeterProvider]:
    """Wire trace + log + metric providers. Idempotent — safe to call multiple
    times (returns the existing providers on re-entry instead of adding
    duplicate handlers to the root logger)."""
    global _initialized, _request_count, _request_duration
    if _initialized is not None:
        return _initialized

    # HTTP exporter takes the full per-signal URL (no `insecure` flag — that
    # was a gRPC-only kwarg). Base URL comes from env; the /v1/* suffix is
    # OTLP-spec-mandated.
    tracer_provider = TracerProvider(resource=_resource)
    tracer_provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{OTLP_ENDPOINT}/v1/traces"))
    )
    trace.set_tracer_provider(tracer_provider)

    logger_provider = LoggerProvider(resource=_resource)
    logger_provider.add_log_record_processor(
        BatchLogRecordProcessor(OTLPLogExporter(endpoint=f"{OTLP_ENDPOINT}/v1/logs"))
    )
    set_logger_provider(logger_provider)

    # Bridge Python logging → OTEL log records. Coexists with the existing
    # python-json-logger stdout handler attached on the root logger.
    otel_handler = LoggingHandler(level=logging.INFO, logger_provider=logger_provider)
    logging.getLogger().addHandler(otel_handler)

    # Metrics: endpoint RED. Periodic reader exports every 60s over OTLP HTTP.
    meter_provider = MeterProvider(
        resource=_resource,
        metric_readers=[
            PeriodicExportingMetricReader(
                OTLPMetricExporter(endpoint=f"{OTLP_ENDPOINT}/v1/metrics"),
                export_interval_millis=60_000,
            )
        ],
    )
    metrics_api.set_meter_provider(meter_provider)
    meter = meter_provider.get_meter(SERVICE_NAME)
    _request_count = meter.create_counter(METRIC.REQUEST_COUNT, unit="{request}")
    _request_duration = meter.create_histogram(METRIC.REQUEST_DURATION, unit="s")

    _initialized = (tracer_provider, logger_provider, meter_provider)
    return _initialized


def record_request(endpoint: str, status_code: int, duration_seconds: float) -> None:
    """Record endpoint RED: one count (by endpoint + ok|error outcome) and the
    handler duration. The single metric chokepoint — callers never touch a
    meter directly. No-op until init_telemetry has run."""
    if _request_count is None or _request_duration is None:
        return
    outcome = "error" if status_code >= 500 else "ok"
    count_attrs: dict[str, str] = {ATTR.ENDPOINT: endpoint, ATTR.OUTCOME: outcome}
    if outcome == "error":
        # Bounded low-cardinality enum on the error path (HTTP status, never a
        # message).
        count_attrs[ATTR.ERROR_TYPE] = str(status_code)
    _request_count.add(1, count_attrs)
    _request_duration.record(duration_seconds, {ATTR.ENDPOINT: endpoint})


def shutdown_telemetry(
    tracer_provider: TracerProvider | None,
    logger_provider: LoggerProvider | None,
    meter_provider: MeterProvider | None = None,
) -> None:
    """Best-effort flush on process exit."""
    if tracer_provider is not None:
        with contextlib.suppress(Exception):
            tracer_provider.shutdown()
    if logger_provider is not None:
        with contextlib.suppress(Exception):
            logger_provider.shutdown()
    if meter_provider is not None:
        with contextlib.suppress(Exception):
            meter_provider.shutdown()
