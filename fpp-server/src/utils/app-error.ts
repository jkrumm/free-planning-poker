import * as Sentry from '@sentry/bun';
import { log } from '../index';

interface ErrorContext {
  component?: string;
  action?: string;
  extra?: Record<string, string | number | boolean | null>;
}

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Captures an error with enriched context and standardized severity mapping.
 * Matches Next.js captureError() API for consistency across services.
 * Automatically logs to Pino (replaces manual log.error calls).
 *
 * @param error - Error object or string message
 * @param context - Context metadata (component, action, extra fields)
 * @param severity - Error severity level (defaults to 'medium')
 *
 * @example
 * captureError(error, {
 *   component: 'messageHandler',
 *   action: 'selectEstimation',
 *   extra: { roomId, userId },
 * }, 'high');
 */
export function captureError(
  error: Error | string,
  context: ErrorContext = {},
  severity: ErrorSeverity = 'medium'
): void {
  const err = typeof error === 'string' ? new Error(error) : error;

  // Map severity to Sentry level
  const levelMap = {
    critical: 'fatal',
    high: 'error',
    medium: 'warning',
    low: 'info',
  } as const;

  // Log to Pino with structured data
  log.error(
    {
      error: err,
      component: context.component ?? 'unknown',
      action: context.action ?? 'unknown',
      severity,
      ...context.extra,
    },
    `[${severity}] ${context.component}:${context.action} - ${err.message}`
  );

  // Send to Sentry (disabled in development)
  Sentry.captureException(err, {
    level: levelMap[severity],
    tags: {
      component: context.component ?? 'unknown',
      action: context.action ?? 'unknown',
      severity,
    },
    extra: context.extra ?? {},
  });
}

/**
 * Captures a message (non-error) with context and severity.
 * Use for informational messages, warnings, or expected errors.
 * Automatically logs to Pino (replaces manual log calls).
 *
 * @param message - Message string
 * @param context - Context metadata (component, action, extra fields)
 * @param severity - Message severity level (defaults to 'medium')
 *
 * @example
 * captureMessage('Unknown action received', {
 *   component: 'messageHandler',
 *   action: 'routeAction',
 *   extra: { action: message.action },
 * }, 'medium');
 */
export function captureMessage(
  message: string,
  context: ErrorContext = {},
  severity: ErrorSeverity = 'medium'
): void {
  const levelMap = {
    critical: 'fatal',
    high: 'error',
    medium: 'warning',
    low: 'info',
  } as const;

  // Log to Pino with structured data (use warn for medium/high, info for low)
  const logFn = severity === 'low' ? log.info : log.warn;
  logFn(
    {
      component: context.component ?? 'unknown',
      action: context.action ?? 'unknown',
      severity,
      ...context.extra,
    },
    `[${severity}] ${context.component}:${context.action} - ${message}`
  );

  // Send to Sentry (disabled in development)
  Sentry.captureMessage(message, {
    level: levelMap[severity],
    tags: {
      component: context.component ?? 'unknown',
      action: context.action ?? 'unknown',
      severity,
    },
    extra: context.extra ?? {},
  });
}

/**
 * Adds a breadcrumb for debugging trail.
 * Use for lifecycle events, critical actions, and state transitions.
 *
 * @param message - Breadcrumb message
 * @param category - Breadcrumb category (e.g., 'websocket', 'message.handler')
 * @param data - Additional structured data
 *
 * @example
 * addBreadcrumb('WebSocket connection opened', 'websocket', {
 *   roomId,
 *   userId,
 * });
 */
export function addBreadcrumb(
  message: string,
  category = 'user',
  data?: Record<string, string | number | boolean | null>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data: data ?? {},
    timestamp: Date.now() / 1000,
  });
}
