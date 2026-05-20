import { SpanStatusCode, trace } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  type EventName,
  type TelemetryAttributes,
} from '@fpp/shared/telemetry';

import { log } from '../index';
import { otelLogger } from '../telemetry';

interface ErrorContext {
  component?: string;
  action?: string;
  extra?: Record<string, string | number | boolean | null>;
}

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_NUMBER: Record<ErrorSeverity, SeverityNumber> = {
  critical: SeverityNumber.FATAL,
  high: SeverityNumber.ERROR,
  medium: SeverityNumber.WARN,
  low: SeverityNumber.INFO,
};

const SEVERITY_TEXT: Record<ErrorSeverity, string> = {
  critical: 'FATAL',
  high: 'ERROR',
  medium: 'WARN',
  low: 'INFO',
};

const flattenExtra = (
  extra: ErrorContext['extra'],
): Record<string, string | number | boolean> => {
  if (!extra) return {};
  // Preserve native types — OTEL AnyValue spec supports primitives; numbers
  // and booleans stay queryable as their actual types in HyperDX.
  return Object.fromEntries(
    Object.entries(extra)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => [`fpp.${k}`, v!]),
  );
};

/**
 * Capture an exception. Records on the active span (if any), emits an OTEL
 * log record correlated by trace_id, and logs to Pino for terminal output.
 */
export function captureError(
  error: Error | string,
  context: ErrorContext = {},
  severity: ErrorSeverity = 'medium',
): void {
  const err = typeof error === 'string' ? new Error(error) : error;
  const flatExtra = flattenExtra(context.extra);

  log.error(
    {
      error: err,
      component: context.component ?? 'unknown',
      action: context.action ?? 'unknown',
      severity,
      ...context.extra,
    },
    `[${severity}] ${context.component}:${context.action} - ${err.message}`,
  );

  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    if (context.component)
      span.setAttribute('fpp.component', context.component);
    if (context.action) span.setAttribute('fpp.action', context.action);
    Object.entries(flatExtra).forEach(([k, v]) => span.setAttribute(k, v));
  }

  otelLogger.emit({
    severityNumber: SEVERITY_NUMBER[severity],
    severityText: SEVERITY_TEXT[severity],
    body: err.message,
    attributes: {
      'exception.type': err.name,
      'exception.message': err.message,
      'exception.stacktrace': err.stack ?? '',
      'fpp.severity': severity,
      ...(context.component && { 'fpp.component': context.component }),
      ...(context.action && { 'fpp.action': context.action }),
      ...flatExtra,
    },
  });
}

/**
 * Capture a non-exception message. Use for informational or
 * warning-level events that aren't errors.
 */
export function captureMessage(
  message: string,
  context: ErrorContext = {},
  severity: ErrorSeverity = 'medium',
): void {
  const logData = {
    component: context.component ?? 'unknown',
    action: context.action ?? 'unknown',
    severity,
    ...context.extra,
  };
  if (severity === 'low') {
    log.info(
      logData,
      `[${severity}] ${context.component}:${context.action} - ${message}`,
    );
  } else {
    log.warn(
      logData,
      `[${severity}] ${context.component}:${context.action} - ${message}`,
    );
  }
  otelLogger.emit({
    severityNumber: SEVERITY_NUMBER[severity],
    severityText: SEVERITY_TEXT[severity],
    body: message,
    attributes: {
      'fpp.severity': severity,
      ...(context.component && { 'fpp.component': context.component }),
      ...(context.action && { 'fpp.action': context.action }),
      ...flattenExtra(context.extra),
    },
  });
}

/**
 * Record a domain event as an OTEL log-based event: an INFO log record carrying
 * `event.name` plus typed, registry-keyed attributes, correlated to the active
 * trace. This is the §3 "log-based Event" signal — discrete, named occurrences
 * we want to count, filter and drill into at full cardinality (room.id, user.id,
 * vote.value live here, never on metrics). Never use span.addEvent (OTEP 4430).
 */
export function recordEvent(
  name: EventName,
  attributes: TelemetryAttributes = {},
): void {
  otelLogger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    attributes: { 'event.name': name, ...attributes },
  });
}

/**
 * Breadcrumb-equivalent: emit an INFO log record correlated to the active
 * trace. Query in HyperDX by trace_id to reconstruct the event timeline.
 */
export function addBreadcrumb(
  message: string,
  category = 'user',
  data?: Record<string, string | number | boolean | null>,
): void {
  otelLogger.emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    body: message,
    attributes: {
      'fpp.breadcrumb': 'true',
      'fpp.category': category,
      ...flattenExtra(data),
    },
  });
}
