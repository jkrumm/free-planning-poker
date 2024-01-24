import { analyticsRouter } from 'fpp/server/api/routers/analytics.router';
import { configRouter } from 'fpp/server/api/routers/config.router';
import { contactRouter } from 'fpp/server/api/routers/contact.router';
import { roadmapRouter } from 'fpp/server/api/routers/roadmap.router';
import { roomRouter } from 'fpp/server/api/routers/room.router';
import { createTRPCRouter } from 'fpp/server/api/trpc';

import { roomStateRouter } from 'fpp/server/room-state/room-state.router';

export const appRouter = createTRPCRouter({
  roomState: roomStateRouter,
  contact: contactRouter,
  config: configRouter,
  room: roomRouter,
  roadmap: roadmapRouter,
  analytics: analyticsRouter,
});

export type AppRouter = typeof appRouter;
