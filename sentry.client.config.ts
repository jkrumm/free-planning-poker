// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  enabled: env.NEXT_PUBLIC_NODE_ENV !== 'development',

  dsn: env.NEXT_PUBLIC_SENTRY_DSN,

  environment: env.NEXT_PUBLIC_NODE_ENV,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: env.NEXT_PUBLIC_NODE_ENV === 'development',

  // Removes personal data from the event to ensure privacy regulations from GDPR
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
      delete event.user.geo;
    }
    if (event.request?.headers) {
      delete event.request.headers;
    }
    return event;
  },

  // TODO: think about Session Replay

  // replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  // replaysSessionSampleRate: 0.5,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  // integrations: [
  //   new Sentry.Replay({
  //     // Additional Replay configuration goes in here, for example:
  //     maskAllText: true,
  //     blockAllMedia: true,
  //   }),
  // ],
});
