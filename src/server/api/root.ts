import { createTRPCRouter } from "fpp/server/api/trpc";
import { ablyRouter } from "fpp/server/api/routers/ably";
import { roomRouter } from "fpp/server/api/routers/room";
import { contactRouter } from "fpp/server/api/routers/contact";

export const appRouter = createTRPCRouter({
  contact: contactRouter,
  ably: ablyRouter,
  room: roomRouter,
});

export type AppRouter = typeof appRouter;
