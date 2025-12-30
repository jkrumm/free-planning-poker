import { logEndpoint } from 'fpp/constants/logging.constant';

import { captureError } from 'fpp/utils/app-error';

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
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(
        `${process.env.NEXT_PUBLIC_API_ROOT}api/track-event`,
        blob,
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
    captureError(
      e instanceof Error ? e : new Error('Failed to track event'),
      {
        component: 'sendTrackEvent',
        action: 'trackEvent',
        extra: {
          endpoint: logEndpoint.TRACK_EVENT,
          userId: userId ?? 'unknown',
          event,
        },
      },
      'medium',
    );
  }
}
