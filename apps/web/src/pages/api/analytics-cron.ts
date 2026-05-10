import { env } from 'fpp/env';

import {
  type NextApiRequest,
  type NextApiResponse,
} from '@trpc/server/adapters/next';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { captureError } from 'fpp/utils/app-error';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const response = await fetch(env.ANALYTICS_URL + '/daily-analytics', {
      headers: {
        Authorization: env.ANALYTICS_SECRET_TOKEN,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to invoke daily analytics: ${response.status} ${response.statusText}`,
      );
    }

    console.log('Daily analytics invoked ', response.status);
    return res.status(200).json({ message: 'Daily analytics invoked' });
  } catch (error) {
    // captureError already logs to console in development mode
    captureError(
      error instanceof Error
        ? error
        : new Error('Error invoking daily analytics'),
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

    return res.status(500).json({ error: 'Internal server error' });
  }
}
