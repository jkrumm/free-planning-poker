import { configRouter } from 'fpp/server/api/routers/config.router';
import { contactRouter } from 'fpp/server/api/routers/contact.router';
import { roadmapRouter } from 'fpp/server/api/routers/roadmap.router';
import { roomRouter } from 'fpp/server/api/routers/room.router';
import { trackingRouter } from 'fpp/server/api/routers/tracking.router';
import { voteRouter } from 'fpp/server/api/routers/vote.router';
import { createTRPCRouter } from 'fpp/server/api/trpc';

import { roomStateRouter } from 'fpp/server/room-state/room-state.router';

export const appRouter = createTRPCRouter({
  roomState: roomStateRouter,
  contact: contactRouter,
  config: configRouter,
  room: roomRouter,
  tracking: trackingRouter,
  vote: voteRouter,
  roadmap: roadmapRouter,
});

export type AppRouter = typeof appRouter;
