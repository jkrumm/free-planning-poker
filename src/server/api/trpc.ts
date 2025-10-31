import { TRPCError, initTRPC } from '@trpc/server';
import {
  type CreateNextContextOptions,
  type NextApiRequest,
  type NextApiResponse,
} from '@trpc/server/adapters/next';

import superjson from 'superjson';
import { ZodError } from 'zod';

import db from 'fpp/server/db/db';

/**
 * Creates the inner tRPC context with request/response objects and database
 * This is called for every request
 */
export const createInnerTRPCContext = (
  req: NextApiRequest,
  res: NextApiResponse,
) => {
  return {
    db,
    req,
    res,
  };
};

/**
 * Creates the tRPC context for Next.js API routes
 * This is the actual context used by tRPC
 */
export const createTRPCContext = (opts: CreateNextContextOptions) => {
  return createInnerTRPCContext(opts.req, opts.res);
};

/**
 * Type helper to infer the context type
 */
type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC with context and configuration
 * v11 best practice: Keep transformer in links, not here
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Export router and procedure helpers
 * These are used to create tRPC routers and procedures
 */
export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/**
 * Global error handling middleware
 * Transforms common database errors into user-friendly TRPCErrors
 * v11 best practice: Use middleware for cross-cutting concerns
 */
const errorHandlingMiddleware = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Handle known database errors
    if (error instanceof Error) {
      // MySQL duplicate key errors
      if (error.message.includes('Duplicate entry')) {
        if (error.message.includes('rooms_name_unique_idx')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Room name already exists',
          });
        }
        if (error.message.includes('rooms_number_unique_idx')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Room number already exists',
          });
        }
      }

      // Connection timeouts
      if (
        error.message.includes('Connection lost') ||
        error.message.includes('timeout')
      ) {
        throw new TRPCError({
          code: 'TIMEOUT',
          message: 'Database connection timeout',
        });
      }
    }

    // Re-throw TRPCErrors as-is
    if (error instanceof TRPCError) {
      throw error;
    }

    // Convert unknown errors to internal server errors
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      cause: error,
    });
  }
});

/**
 * Public procedure with global error handling
 * All procedures should use this to ensure consistent error handling
 */
export const publicProcedure = t.procedure.use(errorHandlingMiddleware);
