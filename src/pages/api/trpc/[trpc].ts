import { type TRPCError } from '@trpc/server';
import { createNextApiHandler } from '@trpc/server/adapters/next';

import * as Sentry from '@sentry/nextjs';

import { appRouter } from 'fpp/server/api/root';
import { createTRPCContext } from 'fpp/server/api/trpc';

export const config = {
  region: 'fra1',
  maxDuration: 10,
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
  } else {
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

export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError: trpcErrorHandler,
});
