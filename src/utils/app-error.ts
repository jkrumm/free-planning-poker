import { TRPCClientError, type TRPCClientErrorLike } from '@trpc/client';

import * as Sentry from '@sentry/nextjs';

export interface ErrorContext {
  component?: string;
  action?: string;
  extra?: Record<string, string | number | boolean | null>;
}

export const captureError = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: Error | string | TRPCClientErrorLike<any>,
  context: ErrorContext = {},
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
): void => {
  context.extra = context.extra
    ? Object.fromEntries(
        Object.entries(context.extra).map(([key, value]) => [
          key,
          String(value),
        ]),
      )
    : {};

  let errorObj: Error;

  if (typeof error === 'string') {
    errorObj = new Error(error);
  } else if (error instanceof TRPCClientError) {
    errorObj = new Error(error.message);
    errorObj.name = 'TRPCClientError';
    errorObj.stack = error.stack;
  } else {
    errorObj = error as Error;
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]', errorObj.message, context);
  }

  Sentry.withScope((scope) => {
    // Set a severity level
    scope.setLevel(
      severity === 'critical'
        ? 'fatal'
        : severity === 'high'
          ? 'error'
          : severity === 'medium'
            ? 'warning'
            : 'info',
    );

    if (context.component) scope.setTag('component', context.component);
    if (context.action) scope.setTag('action', context.action);

    if (error instanceof TRPCClientError) {
      scope.setTag('errorType', 'TRPCClientError');

      if ('input' in context && context) {
        scope.setExtra('trpcInput', context.input);
      }
      if ('output' in context && context) {
        scope.setExtra('trpcOutput', context.output);
      }

      if (error.data && typeof error.data === 'object') {
        const data = error.data as Record<string, unknown>;

        if (
          'code' in data &&
          data.code &&
          (typeof data.code === 'string' || typeof data.code === 'number')
        ) {
          scope.setTag('trpcCode', String(data.code));
        }
        if (
          'httpStatus' in data &&
          data.httpStatus &&
          (typeof data.httpStatus === 'string' ||
            typeof data.httpStatus === 'number')
        ) {
          scope.setTag('httpStatus', String(data.httpStatus));
        }
        if (
          'path' in data &&
          data.path &&
          (typeof data.path === 'string' || typeof data.path === 'number')
        ) {
          scope.setTag('trpcPath', String(data.path));
        }
        if ('zodError' in data && data.zodError) {
          scope.setTag('hasZodError', 'true');
          scope.setExtra('zodError', data.zodError);
        }

        scope.setExtra('trpcErrorData', data);
      }
    }

    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    scope.addBreadcrumb({
      message: `Error in ${context.component ?? 'Unknown'}: ${context.action ?? 'Unknown action'}`,
      level: 'error',
      data: context.extra,
    });

    Sentry.captureException(errorObj);
  });
};

export const captureMessage = (
  message: string,
  context: ErrorContext = {},
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${level.toUpperCase()}]`, message, context);
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
