import { env } from 'fpp/env';

import { TRPCError } from '@trpc/server';
import { createNextApiHandler } from '@trpc/server/adapters/next';

import * as Sentry from '@sentry/nextjs';

import { appRouter } from 'fpp/server/api/root';
import { createTRPCContext } from 'fpp/server/api/trpc';

export const config = {
  // runtime: 'edge',
  region: 'fra1',
};

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

  // Only log and report unexpected errors, not business logic errors
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

    // Report to Sentry
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

    // In production, mask internal errors
    if (env.NEXT_PUBLIC_NODE_ENV === 'production') {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error',
      });
    }
  } else {
    console.debug('TRPC Business Logic Error', {
      type,
      path,
      code: error.code,
      message: error.message,
    });
  }

  throw error;
};

export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError: trpcErrorHandler,
});
