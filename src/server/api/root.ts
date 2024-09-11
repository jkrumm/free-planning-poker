import { analyticsRouter } from 'fpp/server/api/routers/analytics.router';
import { configRouter } from 'fpp/server/api/routers/config.router';
import { contactRouter } from 'fpp/server/api/routers/contact.router';
import { roadmapRouter } from 'fpp/server/api/routers/roadmap.router';
import { roomRouter } from 'fpp/server/api/routers/room.router';
import { createCallerFactory, createTRPCRouter } from 'fpp/server/api/trpc';

export const appRouter = createTRPCRouter({
  contact: contactRouter,
  config: configRouter,
  room: roomRouter,
  roadmap: roadmapRouter,
  analytics: analyticsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
