import { PrismaClient } from "@prisma/client";

import { env } from "fpp/env.mjs";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      env.NEXT_PUBLIC_NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (env.NEXT_PUBLIC_NODE_ENV !== "production") globalForPrisma.prisma = prisma;
