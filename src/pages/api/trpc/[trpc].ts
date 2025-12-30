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

import * as Sentry from '@sentry/nextjs';

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
  const inputObj = input != null && typeof input === 'object' ? input : {};

  // Business logic errors are expected user-facing errors
  const isBusinessLogicError = [
    'BAD_REQUEST',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'PRECONDITION_FAILED',
  ].includes(error.code);

  if (error.code === 'INTERNAL_SERVER_ERROR' || !isBusinessLogicError) {
    // Log internal server errors and unexpected errors
    console.error('TRPC INTERNAL ERROR', {
      ...inputObj,
      type,
      path,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
      },
    });

    // Report to Sentry for monitoring
    Sentry.captureException(error, {
      tags: {
        endpoint: path,
        type,
        trpc_error_code: error.code,
      },
      extra: {
        endpoint: path,
        type,
        ...inputObj,
      },
    });
  } else {
    // Business logic errors are expected, just log as warnings
    console.warn('TRPC Business Logic Error', {
      type,
      path,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
      },
    });
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
