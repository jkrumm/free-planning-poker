import * as Sentry from '@sentry/nextjs';

import { logEndpoint } from 'fpp/constants/logging.constant';

export function sendTrackEvent({
  event,
  userId,
}: {
  event: string;
  userId: string | null;
}) {
  try {
    const body = JSON.stringify({
      userId,
      event,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${process.env.NEXT_PUBLIC_API_ROOT}api/track-event`,
        body,
      );
    } else {
      fetch(`${process.env.NEXT_PUBLIC_API_ROOT}api/track-event`, {
        body,
        method: 'POST',
        keepalive: true,
      }).catch((e) => {
        throw e;
      });
    }
  } catch (e) {
    if (e instanceof Error) {
      Sentry.captureException(e, {
        tags: {
          endpoint: logEndpoint.TRACK_EVENT,
        },
        extra: {
          userId,
          event,
        },
      });
    }
  }
}
