import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      enabled: env.NEXT_PUBLIC_NODE_ENV !== 'development',

      dsn: env.NEXT_PUBLIC_SENTRY_DSN,

      environment: env.NEXT_PUBLIC_NODE_ENV,

      // Adjust this value in production, or use tracesSampler for greater control
      tracesSampleRate: 0.1,

      // Setting this option to true will print useful information to the console while you're setting up Sentry.
      debug: false,

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
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      enabled: env.NEXT_PUBLIC_NODE_ENV !== 'development',

      dsn: env.NEXT_PUBLIC_SENTRY_DSN,

      environment: env.NEXT_PUBLIC_NODE_ENV,

      // Adjust this value in production, or use tracesSampler for greater control
      tracesSampleRate: 0.1,

      // Setting this option to true will print useful information to the console while you're setting up Sentry.
      debug: false,

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
    });
  }
}
