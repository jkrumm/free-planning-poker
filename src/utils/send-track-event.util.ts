import { logEndpoint } from "fpp/constants/logging.constant";
import * as Sentry from "@sentry/nextjs";
import { type Logger } from "next-axiom";

export function sendTrackEvent({
  event,
  userId,
  logger,
}: {
  event: string;
  userId: string | null;
  logger: Logger;
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
        method: "POST",
        keepalive: true,
      }).catch((e) => {
        throw e;
      });
    }
  } catch (e) {
    if (e instanceof Error) {
      logger.error(logEndpoint.TRACK_EVENT, {
        endpoint: logEndpoint.TRACK_EVENT,
        event,
        error: {
          message: e.message,
          stack: e.stack,
          name: e.name,
        },
      });
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
