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
  room?: string,
) => {
  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);

  useEffect(() => {
    sendTrackPageView({ visitorId, route, room, setVisitorId, logger });
  }, [route, room]);
};

export const sendTrackPageView = ({
  visitorId,
  route,
  room,
  setVisitorId,
  logger,
}: {
  visitorId: string | null;
  route: keyof typeof RouteType;
  room?: string;
  setVisitorId: (visitorId: string) => void;
  logger: Logger;
}) => {
  logger.with({ visitorId, route, room });

  try {
    const body = JSON.stringify({
      visitorId,
      route,
      room,
    });
    const url = `${env.NEXT_PUBLIC_API_ROOT}api/track-page-view`;

    if (navigator.sendBeacon && visitorId) {
      navigator.sendBeacon(url, body);
      logger.debug(logEndpoint.TRACK_PAGE_VIEW, {
        withBeacon: true,
      });
    } else {
      fetch(url, { body, method: "POST", keepalive: true })
        .then((res) => res.json() as Promise<{ visitorId: string }>)
        .then(({ visitorId }) => {
          setVisitorId(visitorId);
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
          visitorId,
          route,
          room,
        },
      });
    }
  }
};
