import { TRPCError, initTRPC } from '@trpc/server';
import {
  type CreateNextContextOptions,
  type NextApiRequest,
  type NextApiResponse,
} from '@trpc/server/adapters/next';

import superjson from 'superjson';
import { ZodError } from 'zod';

import db from 'fpp/server/db/db';

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

export const createTRPCContext = (opts: CreateNextContextOptions) => {
  return createInnerTRPCContext(opts.req, opts.res);
};

const t = initTRPC.context<typeof createTRPCContext>().create({
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

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

// Global error handling middleware
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

// Create a protected procedure with global error handling
export const publicProcedure = t.procedure.use(errorHandlingMiddleware);
