"""OpenTelemetry bootstrap for fpp-analytics.

Mirrors the Argo / fpp-server pattern: pure OTEL SDK, OTLP HTTP/protobuf
exporter pointed at the unauthed :4319 receiver on the ClickStack
monitoring-net bridge in prod and at localhost:4319 in dev.
"""

import contextlib
import logging
import os

from opentelemetry import trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
    OTLPSpanExporter,
)
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

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
        "service.version": SERVICE_VERSION,
        "deployment.environment": ENVIRONMENT,
    }
)


_initialized: tuple[TracerProvider, LoggerProvider] | None = None


def init_telemetry() -> tuple[TracerProvider, LoggerProvider]:
    """Wire trace + log providers. Idempotent — safe to call multiple times
    (returns the existing providers on re-entry instead of adding duplicate
    handlers to the root logger)."""
    global _initialized
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

    _initialized = (tracer_provider, logger_provider)
    return _initialized


def shutdown_telemetry(
    tracer_provider: TracerProvider | None, logger_provider: LoggerProvider | None
) -> None:
    """Best-effort flush on process exit."""
    if tracer_provider is not None:
        with contextlib.suppress(Exception):
            tracer_provider.shutdown()
    if logger_provider is not None:
        with contextlib.suppress(Exception):
            logger_provider.shutdown()
