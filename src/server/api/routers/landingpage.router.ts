import { count } from 'drizzle-orm';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { captureError } from 'fpp/utils/app-error';

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
      // captureError already logs to console in development mode
      captureError(
        error instanceof Error
          ? error
          : new Error('Error fetching landing page analytics'),
        {
          component: 'landingpageRouter',
          action: 'getAnalytics',
          extra: {
            endpoint: logEndpoint.GET_LANDINGPAGE_ANALYTICS,
          },
        },
        'high',
      );

      return {
        estimation_count: FALLBACK_ESTIMATION_COUNT,
        user_count: FALLBACK_USER_COUNT,
      };
    }
  }),
});
