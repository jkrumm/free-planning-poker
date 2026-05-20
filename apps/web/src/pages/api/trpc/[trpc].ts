/**
 * tRPC API Handler for Next.js Pages Router.
 *
 * Errors flow through recordError → OTEL log records correlated by trace_id
 * with the active tRPC span. See docs/otel-migration/.
 *
 * @see https://trpc.io/docs/v11/server/adapters/nextjs
 */
import { type NextApiRequest, type NextApiResponse } from 'next';

import { type TRPCError } from '@trpc/server';
import { createNextApiHandler } from '@trpc/server/adapters/next';

import { recordError } from 'fpp/utils/app-error';
// Raw Pino, intentionally: the per-request access log below is stdout-only
// (Logdy locally, Vercel platform logs in prod). Request RED is already covered
// by @vercel/otel spans in HyperDX, so this must NOT emit an OTLP record — it is
// the one justified raw-logger use on web (ESLint-allowlisted in eslint.config).
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
 * tRPC error handler. CustomTRPCError carries metadata (component, action,
 * extra, severity) from routers. recordError records the exception on the
 * active span and emits an OTEL log record with the same trace_id.
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
  // NOTE: strict monitoring — all errors flow through recordError, which writes
  // both a Pino stdout line and a trace-correlated OTEL log record. Switch to
  // isBusinessLogicError(error) gating once we've validated the classification.

  // Check if error has custom metadata from router
  if (error instanceof CustomTRPCError) {
    // Use metadata provided by router (component, action, extra, severity)
    recordError(error, error.metadata, error.metadata.severity ?? 'high');
  } else {
    // Fallback for errors without metadata (uncaught system errors)
    const inputObj = input != null && typeof input === 'object' ? input : {};

    recordError(
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
  const getLogLevel = (statusCode: number): 'error' | 'warn' | 'info' => {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    return 'info';
  };
  const level = getLogLevel(res.statusCode);

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
