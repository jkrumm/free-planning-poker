import { createTRPCRouter } from "fpp/server/api/trpc";
import { ablyRouter } from "fpp/server/api/routers/ably";
import { roomRouter } from "fpp/server/api/routers/room";
import { contactRouter } from "fpp/server/api/routers/contact";
import { trackingRouter } from "fpp/server/api/routers/tracking";

export const appRouter = createTRPCRouter({
  contact: contactRouter,
  ably: ablyRouter,
  room: roomRouter,
  tracking: trackingRouter,
});

export type AppRouter = typeof appRouter;
