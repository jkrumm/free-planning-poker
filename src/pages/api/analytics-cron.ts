import { env } from 'fpp/env';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { captureError } from 'fpp/utils/app-error';

export const dynamic = 'force-dynamic'; // no caching

export default async function handler() {
  await fetch(env.ANALYTICS_URL + '/daily-analytics', {
    headers: {
      Authorization: env.ANALYTICS_SECRET_TOKEN,
    },
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error('Failed to invoke daily analytics ' + res.status);
      }
      console.log('Daily analytics invoked ', res.status);
    })
    .catch((e) => {
      // captureError already logs to console in development mode
      captureError(
        e instanceof Error ? e : new Error('Error invoking daily analytics'),
        {
          component: 'analytics-cron',
          action: 'invokeDailyAnalytics',
          extra: {
            endpoint: logEndpoint.DAILY_ANALYTICS,
            analyticsUrl: env.ANALYTICS_URL + '/daily-analytics',
          },
        },
        'high',
      );
      return { message: 'Error invoking daily analytics', status: 500 };
    });

  return { message: 'Daily analytics invoked', status: 200 };
}
