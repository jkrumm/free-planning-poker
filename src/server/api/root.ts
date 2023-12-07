import { createTRPCRouter } from "fpp/server/api/trpc";
import { roomRouter } from "fpp/server/api/routers/room.router";
import { contactRouter } from "fpp/server/api/routers/contact.router";
import { trackingRouter } from "fpp/server/api/routers/tracking.router";
import { voteRouter } from "fpp/server/api/routers/vote.router";
import { roadmapRouter } from "fpp/server/api/routers/roadmap.router";
import { featureFlagRouter } from "fpp/server/api/routers/feature-flag.router";

export const appRouter = createTRPCRouter({
  contact: contactRouter,
  featureFlag: featureFlagRouter,
  room: roomRouter,
  tracking: trackingRouter,
  vote: voteRouter,
  roadmap: roadmapRouter,
});

export type AppRouter = typeof appRouter;
