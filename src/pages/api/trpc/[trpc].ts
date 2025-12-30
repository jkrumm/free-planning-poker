/**
 * tRPC API Handler for Next.js Pages Router
 * This is the main entry point for all tRPC requests
 *
 * v11 best practices:
 * - Type-safe error handling with proper Sentry integration
 * - Proper logging distinction between business logic and system errors
 * - Vercel deployment configuration
 *
 * @see https://trpc.io/docs/v11/server/adapters/nextjs
 */
import { type TRPCError } from '@trpc/server';
import { createNextApiHandler } from '@trpc/server/adapters/next';

import { captureError } from 'fpp/utils/app-error';

import {
  CustomTRPCError,
  isBusinessLogicError,
} from 'fpp/server/api/custom-error';
import { appRouter } from 'fpp/server/api/root';
import { createTRPCContext } from 'fpp/server/api/trpc';

/**
 * Vercel deployment configuration
 * @see https://vercel.com/docs/functions/runtimes#max-duration
 */
export const config = {
  region: 'fra1',
  maxDuration: 10,
};

/**
 * Custom error handler for tRPC
 * v11 best practice: Distinguish between business logic errors and system errors
 *
 * Business logic errors (BAD_REQUEST, NOT_FOUND, etc.) are expected and logged as warnings
 * System errors (INTERNAL_SERVER_ERROR, etc.) are unexpected and reported to Sentry
 *
 * CustomTRPCError carries metadata from routers for enhanced error tracking
 */
const trpcErrorHandler = ({
  error,
  type,
  path,
  input,
}: {
  error: TRPCError;
  type: 'query' | 'mutation' | 'subscription' | 'unknown';
  path: string | undefined;
  input: unknown;
}) => {
  // Business logic errors are expected - log but don't capture in Sentry
  // NOTE: Starting with strict monitoring - capturing all business logic errors initially
  // to ensure nothing is missed. Will gradually open up as we confirm expected behavior.
  if (isBusinessLogicError(error)) {
    console.warn('TRPC Business Logic Error', {
      type,
      path,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
      },
    });
    // TODO: Once confident in error classification, keep this return uncommented
    // For now, temporarily comment out to capture business logic errors in Sentry
    return;
  }

  // System errors should be captured
  console.error('TRPC System Error', {
    type,
    path,
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
    },
  });

  // Check if error has custom metadata from router
  if (error instanceof CustomTRPCError) {
    // Use metadata provided by router (component, action, extra, severity)
    captureError(error, error.metadata, error.metadata.severity ?? 'high');
  } else {
    // Fallback for errors without metadata (uncaught system errors)
    const inputObj = input != null && typeof input === 'object' ? input : {};

    captureError(
      error,
      {
        component: 'trpcMiddleware',
        action: path ?? 'unknown',
        extra: {
          endpoint: path ?? 'unknown',
          type,
          trpc_error_code: error.code,
          ...(Object.keys(inputObj).length > 0 &&
          Object.keys(inputObj).length <= 5
            ? inputObj
            : { inputKeyCount: Object.keys(inputObj).length }),
        },
      },
      'high',
    );
  }
};

/**
 * Export Next.js API handler
 * v11: Uses createNextApiHandler for Pages Router
 */
export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError: trpcErrorHandler,
});
