import { useEffect } from "react";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { type RouteType } from "@prisma/client";
import { env } from "fpp/env.mjs";
import { log } from "fpp/constants/error.constant";
import { logMsg } from "fpp/constants/logging.constant";

export const useTrackPageView = (route: RouteType, room?: string) => {
  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);

  useEffect(() => {
    sendTrackPageView({ visitorId, route, room, setVisitorId });
  }, [route, room]);
};

export const sendTrackPageView = ({
  visitorId,
  route,
  room,
  setVisitorId,
}: {
  visitorId: string | null;
  route: RouteType;
  room?: string;
  setVisitorId: (visitorId: string) => void;
}) => {
  const body = JSON.stringify({
    visitorId,
    route,
    room,
  });
  const url = `${env.NEXT_PUBLIC_API_ROOT}api/track-page-view`;

  if (navigator.sendBeacon && visitorId) {
    navigator.sendBeacon(url, body);
    log.debug(logMsg.TRACK_PAGE_VIEW, {
      withBeacon: true,
      visitorId,
      route,
      room,
    });
  } else {
    fetch(url, { body, method: "POST", keepalive: true })
      .then((res) => res.json() as Promise<{ visitorId: string }>)
      .then(({ visitorId }) => {
        setVisitorId(visitorId);
        log.debug(logMsg.TRACK_PAGE_VIEW, {
          withBeacon: false,
          visitorId,
          route,
          room,
        });
      })
      .catch(() => {
        // TODO: sentry
      });
  }
};
