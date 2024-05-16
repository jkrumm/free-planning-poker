// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
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
