import { type NextRequest } from 'next/server';

import { env } from 'fpp/env.mjs';

import { TRPCError } from '@trpc/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import * as Sentry from '@sentry/nextjs';

import { appRouter } from 'fpp/server/api/root';
import { createTRPCContext } from 'fpp/server/api/trpc';

export const config = {
  runtime: 'edge',
  region: 'fra1',
};

export default async function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    router: appRouter,
    req,
    createContext: createTRPCContext,
    onError: trpcErrorHandler,
  });
}

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

  if (
    error.constructor.name === 'Error' ||
    error.code === 'INTERNAL_SERVER_ERROR'
  ) {
    console.error('TRPC ERROR', {
      ...inputObj,
      type,
      path,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
    Sentry.captureException(error, {
      tags: {
        endpoint: path,
        type,
      },
      extra: {
        endpoint: path,
        type,
        ...inputObj,
      },
    });

    if (env.NEXT_PUBLIC_NODE_ENV === 'production') {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error',
      });
    } else {
      throw error;
    }
  }
  console.warn('TRPC ERROR', {
    ...inputObj,
    type,
    path,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
  });
  throw error;
};
