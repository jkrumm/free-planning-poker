import { logEndpoint } from "fpp/constants/logging.constant";
import * as Sentry from "@sentry/nextjs";
import { type Logger } from "next-axiom";

export function sendTrackEstimation({
  userId,
  estimation,
  roomId,
  spectator,
  logger,
}: {
  userId: string | null;
  roomId: number;
  estimation: number | null;
  spectator: boolean;
  logger: Logger;
}) {
  try {
    const body = JSON.stringify({
      userId,
      estimation,
      roomId,
      spectator,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${process.env.NEXT_PUBLIC_API_ROOT}api/track-estimation`,
        body,
      );
    } else {
      fetch(`${process.env.NEXT_PUBLIC_API_ROOT}api/track-estimation`, {
        body,
        method: "POST",
        keepalive: true,
      }).catch((e) => {
        throw e;
      });
    }
  } catch (e) {
    if (e instanceof Error) {
      logger.error(logEndpoint.TRACK_ESTIMATION, {
        endpoint: logEndpoint.TRACK_ESTIMATION,
        estimation,
        roomId,
        spectator,
        error: {
          message: e.message,
          stack: e.stack,
          name: e.name,
        },
      });
      Sentry.captureException(e, {
        tags: {
          endpoint: logEndpoint.TRACK_ESTIMATION,
        },
        extra: {
          userId,
          roomId,
          estimation,
          spectator,
        },
      });
    }
  }
}
