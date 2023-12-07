import { env } from "fpp/env.mjs";
import { appRouter } from "fpp/server/api/root";
import { createTRPCContext } from "fpp/server/api/trpc";

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { type NextRequest } from "next/server";

export const config = {
  runtime: "edge",
  region: ["fra1", "sfo1", "sin1"],
};

export default async function handler(req: NextRequest) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: createTRPCContext,
    onError:
      env.NEXT_PUBLIC_NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`,
            );
          }
        : undefined,
  });
}
