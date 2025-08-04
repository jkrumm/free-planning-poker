// This file configures the initialization of Sentry on the client.
import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  enabled: env.NEXT_PUBLIC_NODE_ENV !== 'development',
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  environment: env.NEXT_PUBLIC_NODE_ENV,

  // Performance monitoring
  tracesSampleRate: env.NEXT_PUBLIC_NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session replay for better debugging
  // replaysSessionSampleRate:
  //   env.NEXT_PUBLIC_NODE_ENV === 'production' ? 0.1 : 1.0,
  // replaysOnErrorSampleRate: 1.0,

  debug: env.NEXT_PUBLIC_NODE_ENV === 'development',

  // Enhanced integrations
  integrations: [Sentry.browserTracingIntegration()],

  tracePropagationTargets: [
    'localhost',
    env.NEXT_PUBLIC_FPP_SERVER_URL,
    /^https:\/\/[^/]*\.vercel\.app\//,
  ],

  // Enhanced beforeSend for better error filtering and context
  beforeSend(event, hint) {
    // Remove personal data for GDPR compliance
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
      delete event.user.geo;
    }
    if (event.request?.headers) {
      delete event.request.headers;
    }

    // Filter out noisy errors
    const error = hint.originalException as Error;
    const errorMessage =
      typeof error === 'string' ? error : error?.message || '';

    // Skip common browser/development errors
    const noisyErrors = [
      'WebSocket connection failed',
      'Loading chunk',
      'ChunkLoadError',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      'Network request failed',
      'ERR_INTERNET_DISCONNECTED',
      'ERR_NETWORK_CHANGED',
    ];

    if (noisyErrors.some((noise) => errorMessage.includes(noise))) {
      return null;
    }

    // Skip WebSocket 1006 errors (normal connection close)
    if (errorMessage.includes('WebSocket') && errorMessage.includes('1006')) {
      return null;
    }

    // Add automatic room context if available
    if (typeof window !== 'undefined') {
      const roomId = localStorage.getItem('roomId');
      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');

      if (roomId && !event.tags?.roomId) {
        event.tags = { ...event.tags, roomId };
      }
      if (userId && !event.tags?.userId) {
        event.tags = { ...event.tags, userId };
      }
      if (username && !event.extra?.username) {
        event.extra = { ...event.extra, username };
      }
    }

    return event;
  },

  // Global error handler setup
  beforeBreadcrumb(breadcrumb) {
    // Filter out noisy breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
      return null;
    }

    // Enhance navigation breadcrumbs with room context
    if (breadcrumb.category === 'navigation' && typeof window !== 'undefined') {
      const roomId = localStorage.getItem('roomId');
      const userId = localStorage.getItem('userId');
      if (roomId) {
        breadcrumb.data = { ...breadcrumb.data, roomId, userId };
      }
    }

    return breadcrumb;
  },
});

// Global error handlers
if (typeof window !== 'undefined') {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    Sentry.captureException(event.reason);
  });

  // Handle global errors
  window.addEventListener('error', (event) => {
    Sentry.captureException(event.error);
  });
}
