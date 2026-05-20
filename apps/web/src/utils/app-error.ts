import { TRPCClientError, type TRPCClientErrorLike } from '@trpc/client';

import {
  ATTR,
  type EventName,
  type TelemetryAttributes,
} from '@fpp/shared/telemetry';
import HyperDX from '@hyperdx/browser';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { SeverityNumber, logs } from '@opentelemetry/api-logs';

import { logger } from './logger';

export interface ErrorContext {
  component?: string;
  action?: string;
  extra?: Record<string, string | number | boolean | null>;
}

type Severity = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_NUMBER: Record<Severity, SeverityNumber> = {
  critical: SeverityNumber.FATAL,
  high: SeverityNumber.ERROR,
  medium: SeverityNumber.WARN,
  low: SeverityNumber.INFO,
};

const SEVERITY_TEXT: Record<Severity, string> = {
  critical: 'FATAL',
  high: 'ERROR',
  medium: 'WARN',
  low: 'INFO',
};

// Lazy lookup — instrumentation.register() (server) and instrumentation-client
// (browser) both run before the first request handler, but module load order
// of app-error.ts vs the registration call isn't guaranteed. Calling
// logs.getLogger() at module load can capture a NoopLogger reference that
// never refreshes. Fetching per-call respects the current global provider.
const getOtelLogger = () => logs.getLogger('fpp-web');

const normalizeError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: Error | string | TRPCClientErrorLike<any>,
): Error => {
  if (typeof error === 'string') return new Error(error);
  if (error instanceof TRPCClientError) {
    const errObj = new Error(error.message);
    errObj.name = 'TRPCClientError';
    errObj.stack = error.stack;
    return errObj;
  }
  return error as Error;
};

const trpcAttributes = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: TRPCClientError<any>,
): Record<string, string> => {
  const attrs: Record<string, string> = { 'error.type': 'TRPCClientError' };
  if (!error.data || typeof error.data !== 'object') return attrs;
  const data = error.data as Record<string, unknown>;
  for (const [key, attr] of [
    ['code', 'trpc.code'],
    ['httpStatus', 'http.status_code'],
    ['path', 'trpc.path'],
  ] as const) {
    const value = data[key];
    if (value && (typeof value === 'string' || typeof value === 'number')) {
      attrs[attr] = String(value);
    }
  }
  if (data.zodError) attrs['trpc.has_zod_error'] = 'true';
  return attrs;
};

const flattenExtra = (
  extra: Record<string, string | number | boolean | null> | undefined,
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

// Browser-only mutable user context. HyperDX.setGlobalAttributes attaches
// these at the RUM-session layer (for the UI's session view), not the OTLP
// exporter — so spans/logs leaving the browser don't carry them by default.
// We mirror the same values here and auto-merge into every recordError /
// recordEvent call so the data is queryable in ClickHouse without callers
// having to thread userId/roomId everywhere.
let userContext: {
  userId?: string;
  roomId?: string;
  username?: string;
} = {};

const userContextAttrs = (): Record<string, string> => {
  const out: Record<string, string> = {};
  if (userContext.userId) out[ATTR.USER_ID] = userContext.userId;
  if (userContext.roomId) out[ATTR.ROOM_ID] = userContext.roomId;
  if (userContext.username) out[ATTR.USER_NAME] = userContext.username;
  return out;
};

export const recordError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: Error | string | TRPCClientErrorLike<any>,
  context: ErrorContext = {},
  severity: Severity = 'medium',
): void => {
  const errorObj = normalizeError(error);
  const flatExtra = flattenExtra(context.extra);

  logger.error(
    {
      component: context.component,
      action: context.action,
      severity,
      error: {
        name: errorObj.name,
        message: errorObj.message,
        stack: errorObj.stack,
      },
      ...context.extra,
    },
    `[${severity}] ${context.component ?? 'Unknown'}:${context.action ?? 'Unknown'} - ${errorObj.message}`,
  );

  // Attach to active span (server-side: tRPC span, browser: HyperDX-managed)
  const span = trace.getActiveSpan();
  if (span) {
    // TODO(otel): migrate to a log-based exception event per OTEP 4430 once the
    // converting processor is wired into SDK init; recordException is shimmed.
    span.recordException(errorObj);
    span.setStatus({ code: SpanStatusCode.ERROR, message: errorObj.message });
    Object.entries(flatExtra).forEach(([k, v]) => span.setAttribute(k, v));
    if (context.component)
      span.setAttribute('fpp.component', context.component);
    if (context.action) span.setAttribute('fpp.action', context.action);
  }

  const trpcAttrs =
    error instanceof TRPCClientError ? trpcAttributes(error) : {};

  getOtelLogger().emit({
    severityNumber: SEVERITY_NUMBER[severity],
    severityText: SEVERITY_TEXT[severity],
    body: errorObj.message,
    attributes: {
      'exception.type': errorObj.name,
      'exception.message': errorObj.message,
      'exception.stacktrace': errorObj.stack ?? '',
      'fpp.severity': severity,
      ...(context.component && { 'fpp.component': context.component }),
      ...(context.action && { 'fpp.action': context.action }),
      ...userContextAttrs(),
      ...trpcAttrs,
      ...flatExtra,
    },
  });
};

/**
 * Record a client-only domain event as an OTEL log-based event: an INFO log
 * record carrying `event.name` + the current user/room context + typed,
 * registry-keyed attributes, correlated to the active trace. The browser only
 * emits the few W events the authoritative server can't observe (spec §7);
 * everything domain-level is emitted server-side. Never use span.addEvent
 * (OTEP 4430).
 */
export const recordEvent = (
  name: EventName,
  attributes: TelemetryAttributes = {},
): void => {
  getOtelLogger().emit({
    severityNumber: SeverityNumber.INFO,
    severityText: 'INFO',
    attributes: {
      'event.name': name,
      ...userContextAttrs(),
      ...attributes,
    },
  });
};

/**
 * Tag every subsequent browser span/log with user + room context so
 * HyperDX can filter sessions and group traces by room. Server-side no-op.
 * Replaces the sentry-context-provider's `setUser` + `setTag` calls.
 */
export const setUserContext = (ctx: {
  userId?: string | null;
  roomId?: number | null;
  username?: string | null;
}): void => {
  if (typeof window === 'undefined') return;
  HyperDX.setGlobalAttributes({
    ...(ctx.userId && { userId: ctx.userId }),
    ...(ctx.roomId && { roomId: String(ctx.roomId) }),
    ...(ctx.username && { username: ctx.username }),
  });
  // Mirror into the wrapper's own state so recordError / recordEvent
  // pick it up automatically.
  userContext = {
    ...(ctx.userId && { userId: ctx.userId }),
    ...(ctx.roomId && { roomId: String(ctx.roomId) }),
    ...(ctx.username && { username: ctx.username }),
  };
};
