import { useEffect } from "react";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { env } from "fpp/env.mjs";
import { logEndpoint } from "fpp/constants/logging.constant";
import { type Logger } from "next-axiom";
import * as Sentry from "@sentry/nextjs";
import { type RouteType } from "fpp/server/db/schema";

export const useTrackPageView = (
  route: keyof typeof RouteType,
  logger: Logger,
  roomId?: number,
) => {
  const userId = useLocalstorageStore((state) => state.userId);
  const setUserId = useLocalstorageStore((state) => state.setUserId);

  useEffect(() => {
    sendTrackPageView({ userId, route, roomId, setUserId, logger });
  }, [route, roomId]);
};

export const sendTrackPageView = ({
  userId,
  route,
  roomId,
  setUserId,
  logger,
}: {
  userId: string | null;
  route: keyof typeof RouteType;
  roomId?: number;
  setUserId: (userId: string) => void;
  logger: Logger;
}) => {
  logger.with({ userId, route, roomId });

  try {
    const body = JSON.stringify({
      userId,
      route,
      roomId,
    });
    const url = `${env.NEXT_PUBLIC_API_ROOT}api/track-page-view`;

    if (navigator.sendBeacon && userId) {
      navigator.sendBeacon(url, body);
      logger.debug(logEndpoint.TRACK_PAGE_VIEW, {
        withBeacon: true,
      });
    } else {
      fetch(url, { body, method: "POST", keepalive: true })
        .then((res) => res.json() as Promise<{ userId: string }>)
        .then(({ userId }) => {
          setUserId(userId);
          logger.debug(logEndpoint.TRACK_PAGE_VIEW, {
            withBeacon: false,
          });
        })
        .catch((e) => {
          throw e;
        });
    }
  } catch (e) {
    if (e instanceof Error) {
      logger.error(logEndpoint.TRACK_PAGE_VIEW, {
        endpoint: logEndpoint.TRACK_PAGE_VIEW,
        error: {
          message: e.message,
          stack: e.stack,
          name: e.name,
        },
      });
      Sentry.captureException(e, {
        tags: {
          endpoint: logEndpoint.TRACK_PAGE_VIEW,
        },
        extra: {
          userId,
          route,
          roomId,
        },
      });
    }
  }
};
