import * as Sentry from '@sentry/nextjs';

// Export onRequestError hook for Next.js 15 error capturing
// This captures errors from nested React Server Components and other server-side errors
export const onRequestError = Sentry.captureRequestError;

// Register function that conditionally imports the correct Sentry config based on runtime
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
