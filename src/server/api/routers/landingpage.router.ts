import * as Sentry from '@sentry/nextjs';
import { count } from 'drizzle-orm';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';
import db from 'fpp/server/db/db';
import { estimations, users } from 'fpp/server/db/schema';

const FALLBACK_ESTIMATION_COUNT = 70000;
const FALLBACK_USER_COUNT = 10000;

export const landingpageRouter = createTRPCRouter({
  getAnalytics: publicProcedure.query(async () => {
    try {
      const [estimationResult, userResult] = await Promise.all([
        db.select({ count: count() }).from(estimations),
        db.select({ count: count() }).from(users),
      ]);

      return {
        estimation_count:
          estimationResult[0]?.count ?? FALLBACK_ESTIMATION_COUNT,
        user_count: userResult[0]?.count ?? FALLBACK_USER_COUNT,
      };
    } catch (error) {
      console.error('Error fetching landing page analytics:', error);
      Sentry.captureException(error, {
        tags: { endpoint: logEndpoint.GET_LANDINGPAGE_ANALYTICS },
      });

      return {
        estimation_count: FALLBACK_ESTIMATION_COUNT,
        user_count: FALLBACK_USER_COUNT,
      };
    }
  }),
});
