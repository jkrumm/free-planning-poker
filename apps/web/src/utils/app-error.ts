import { TRPCClientError, type TRPCClientErrorLike } from '@trpc/client';

import * as Sentry from '@sentry/nextjs';

import { logger } from './logger';

export interface ErrorContext {
  component?: string;
  action?: string;
  extra?: Record<string, string | number | boolean | null>;
}

type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Map severity level to Sentry level
 */
const mapSeverityToSentryLevel = (
  severity: Severity,
): 'fatal' | 'error' | 'warning' | 'info' => {
  const levelMap: Record<Severity, 'fatal' | 'error' | 'warning' | 'info'> = {
    critical: 'fatal',
    high: 'error',
    medium: 'warning',
    low: 'info',
  };
  return levelMap[severity];
};

/**
 * Set TRPC-specific tags on Sentry scope
 */
const setTRPCErrorTags = (
  scope: Sentry.Scope,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: TRPCClientError<any>,
  context: ErrorContext,
): void => {
  scope.setTag('errorType', 'TRPCClientError');

  if ('input' in context) scope.setExtra('trpcInput', context.input);
  if ('output' in context) scope.setExtra('trpcOutput', context.output);

  if (!error.data || typeof error.data !== 'object') return;

  const data = error.data as Record<string, unknown>;

  // Set tags for known TRPC data fields
  const tagMappings: Array<{ key: string; tag: string }> = [
    { key: 'code', tag: 'trpcCode' },
    { key: 'httpStatus', tag: 'httpStatus' },
    { key: 'path', tag: 'trpcPath' },
  ];

  for (const { key, tag } of tagMappings) {
    const value = data[key];
    if (value && (typeof value === 'string' || typeof value === 'number')) {
      scope.setTag(tag, String(value));
    }
  }

  if (data.zodError) {
    scope.setTag('hasZodError', 'true');
    scope.setExtra('zodError', data.zodError);
  }

  scope.setExtra('trpcErrorData', data);
};

/**
 * Create an Error object from various input types
 */
const normalizeError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: Error | string | TRPCClientErrorLike<any>,
): Error => {
  if (typeof error === 'string') {
    return new Error(error);
  }

  if (error instanceof TRPCClientError) {
    const errorObj = new Error(error.message);
    errorObj.name = 'TRPCClientError';
    errorObj.stack = error.stack;
    return errorObj;
  }

  return error as Error;
};

export const captureError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: Error | string | TRPCClientErrorLike<any>,
  context: ErrorContext = {},
  severity: Severity = 'medium',
): void => {
  const extra = context.extra
    ? Object.fromEntries(
        Object.entries(context.extra).map(([key, value]) => [
          key,
          String(value),
        ]),
      )
    : {};
  context.extra = extra;

  const errorObj = normalizeError(error);

  // Log to Pino before sending to Sentry
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
      ...extra,
    },
    `[${severity}] ${context.component ?? 'Unknown'}:${context.action ?? 'Unknown'} - ${errorObj.message}`,
  );

  Sentry.withScope((scope) => {
    scope.setLevel(mapSeverityToSentryLevel(severity));

    if (context.component) scope.setTag('component', context.component);
    if (context.action) scope.setTag('action', context.action);

    if (error instanceof TRPCClientError) {
      setTRPCErrorTags(scope, error, context);
    }

    Object.entries(extra).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    scope.addBreadcrumb({
      message: `Error in ${context.component ?? 'Unknown'}: ${context.action ?? 'Unknown action'}`,
      level: 'error',
      data: extra,
    });

    Sentry.captureException(errorObj);
  });
};

export const captureMessage = (
  message: string,
  context: ErrorContext = {},
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
): void => {
  // Log to Pino before sending to Sentry
  const logData = {
    component: context.component,
    action: context.action,
    ...context.extra,
  };

  switch (level) {
    case 'debug':
      logger.debug(logData, message);
      break;
    case 'info':
      logger.info(logData, message);
      break;
    case 'warning':
      logger.warn(logData, message);
      break;
    case 'error':
      logger.error(logData, message);
      break;
  }

  Sentry.withScope((scope) => {
    if (context.component) scope.setTag('component', context.component);
    if (context.action) scope.setTag('action', context.action);

    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureMessage(message, level);
  });
};

export const addBreadcrumb = (
  message: string,
  category = 'user',
  data?: Record<string, string | number | null | boolean>,
): void => {
  data = data
    ? Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)]),
      )
    : {};

  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
  });
};
