/**
 * This is the client-side entrypoint for your tRPC API.
 * It creates the `api` object which contains type-safe React Query hooks.
 *
 * tRPC v11 configuration for Next.js Pages Router
 * @see https://trpc.io/docs/client/nextjs/setup
 */
import { httpBatchLink, loggerLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/next';
import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';

import superjson from 'superjson';

import { type AppRouter } from 'fpp/server/api/root';

/**
 * Get the base URL for API calls
 * v11 best practice: Handle different deployment environments
 */
const getBaseUrl = () => {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3001}`; // dev SSR should use localhost
};

/**
 * A set of type-safe React Query hooks for your tRPC API
 * v11: Transformer must be specified in BOTH root config and httpBatchLink
 */
export const api = createTRPCNext<AppRouter>({
  config() {
    return {
      /**
       * Links used to determine request flow from client to server
       *
       * @see https://trpc.io/docs/v11/client/links
       */
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        httpBatchLink({
          /**
           * v11: Transformer configured in link for serialization
           *
           * @see https://trpc.io/docs/v11/data-transformers
           */
          transformer: superjson,
          url: `${getBaseUrl()}/api/trpc`,
        }),
      ],
    };
  },
  /**
   * Whether tRPC should await queries when server rendering pages
   * Set to false for client-side only rendering
   *
   * @see https://trpc.io/docs/v11/client/nextjs/setup
   */
  ssr: false,
  /**
   * v11: Transformer also required at root level for type inference
   *
   * @see https://trpc.io/docs/v11/data-transformers
   */
  transformer: superjson,
});

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
