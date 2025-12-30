import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';

import { logEndpoint } from 'fpp/constants/logging.constant';

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
      console.error('Error invoking daily analytics', e, {
        route: env.ANALYTICS_URL + '/daily-analytics',
      });
      Sentry.captureException(e, {
        tags: {
          endpoint: logEndpoint.DAILY_ANALYTICS,
        },
      });
      return { message: 'Error invoking daily analytics', status: 500 };
    });

  return { message: 'Daily analytics invoked', status: 200 };
}
