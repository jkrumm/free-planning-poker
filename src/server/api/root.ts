import { createTRPCRouter } from "fpp/server/api/trpc";
import { ablyRouter } from "fpp/server/api/routers/ably";
import { roomRouter } from "fpp/server/api/routers/room";

export const appRouter = createTRPCRouter({
  ably: ablyRouter,
  room: roomRouter,
});

export type AppRouter = typeof appRouter;
