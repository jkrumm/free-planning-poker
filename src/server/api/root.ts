import { createTRPCRouter } from "~/server/api/trpc";
import { exampleRouter } from "~/server/api/routers/example";
import { ablyRouter } from "~/server/api/routers/ably";
import { roomRouter } from "~/server/api/routers/room";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  example: exampleRouter,
  ably: ablyRouter,
  room: roomRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
