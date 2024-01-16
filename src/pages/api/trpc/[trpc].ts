import { appRouter } from "fpp/server/api/root";
import { createTRPCContext } from "fpp/server/api/trpc";

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";
import { TRPCError } from "@trpc/server";
import * as Sentry from "@sentry/nextjs";
import { env } from "fpp/env.mjs";

export const config = {
  runtime: "edge",
  region: "fra1",
};

export default async function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
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
  type: "query" | "mutation" | "subscription" | "unknown";
  path: string | undefined;
  input: unknown;
}) => {
  const inputObj = input != null && typeof input === "object" ? input : {};
  const errorObj = { error, type, path };
  if (
    error.constructor.name === "Error" ||
    error.code === "INTERNAL_SERVER_ERROR"
  ) {
    console.error("TRPC ERROR", { ...inputObj, ...errorObj });
    Sentry.captureException(errorObj, {
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

    if (env.NEXT_PUBLIC_NODE_ENV === "production") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal Server Error",
      });
    } else {
      throw error;
    }
  }
  console.warn("TRPC ERROR", { ...inputObj, ...errorObj });
  throw error;
};
