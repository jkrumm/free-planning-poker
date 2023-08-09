import { createTRPCRouter } from "fpp/server/api/trpc";
import { roomRouter } from "fpp/server/api/routers/room";
import { contactRouter } from "fpp/server/api/routers/contact";
import { trackingRouter } from "fpp/server/api/routers/tracking";
import { voteRouter } from "fpp/server/api/routers/vote";
import { roadmapRouter } from "fpp/server/api/routers/roadmap";

export const appRouter = createTRPCRouter({
  contact: contactRouter,
  room: roomRouter,
  tracking: trackingRouter,
  vote: voteRouter,
  roadmap: roadmapRouter,
});

export type AppRouter = typeof appRouter;
