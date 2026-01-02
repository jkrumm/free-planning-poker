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
import { type NextApiRequest, type NextApiResponse } from 'next';

import { type TRPCError } from '@trpc/server';
import { createNextApiHandler } from '@trpc/server/adapters/next';

import { captureError } from 'fpp/utils/app-error';
import { logger } from 'fpp/utils/logger';

import { CustomTRPCError } from 'fpp/server/api/custom-error';
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
  // NOTE: Below is for now disabled to start with strict monitoring and later on allow isBusinessLogicError to not go to Sentry
  // Business logic errors are expected - log but don't capture in Sentry
  // NOTE: Starting with strict monitoring via logger.warn to ensure correct error classification.
  // These errors (NOT_FOUND, BAD_REQUEST, etc.) are NOT captured in Sentry (as intended).
  // if (isBusinessLogicError(error)) {
  //   logger.warn({
  //     component: 'trpcErrorHandler',
  //     action: path ?? 'unknown',
  //     type,
  //     errorName: error.name,
  //     errorCode: error.code,
  //   }, 'tRPC Business Logic Error');
  //   // Skip Sentry capture for expected business logic errors
  //   return;
  // }

  logger.error(
    {
      component: 'trpcErrorHandler',
      action: path ?? 'unknown',
      type,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
      },
    },
    'tRPC System Error',
  );

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
 * Base tRPC handler
 * v11: Uses createNextApiHandler for Pages Router
 */
const trpcHandler = createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError: trpcErrorHandler,
});

/**
 * Wrapped handler with request logging
 * Logs all tRPC requests in structured JSON format
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const start = Date.now();

  // Execute tRPC handler
  await trpcHandler(req, res);

  // Log request after completion
  const duration = Date.now() - start;
  const level =
    res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

  logger[level](
    {
      component: 'trpcHandler',
      action: req.url?.split('?')[0] ?? 'unknown',
      method: req.method,
      path: req.url,
      status: res.statusCode,
      duration,
    },
    `${req.method} ${req.url} ${res.statusCode} in ${duration}ms`,
  );
}
