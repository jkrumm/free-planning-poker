import { NextResponse } from 'next/server';

import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';

import { logEndpoint } from 'fpp/constants/logging.constant';

export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // no caching

export default async function handler() {
  await fetch(env.ANALYTICS_URL + '/daily-analytics', {
    headers: {
      Authorization: env.ANALYTICS_SECRET_TOKEN,
    },
  })
    .then((res) => {
      console.log('Daily analytics invoked ', res.status);
    })
    .catch((e) => {
      console.error('Error invoking daily analytics', e);
      Sentry.captureException(e, {
        tags: {
          endpoint: logEndpoint.DAILY_ANALYTICS,
        },
      });
      return new NextResponse('Error invoking daily analytics', {
        status: 500,
      });
    });

  return new NextResponse('Daily analytics invoked', {
    status: 200,
  });
}
