import { useEffect } from "react";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { type RouteType } from "@prisma/client";
import { type MutateFunction } from "@tanstack/query-core";
import { log } from "fpp/utils/console-log";
import { env } from "fpp/env.mjs";

export type TrackPageViewMutation = MutateFunction<
  string,
  unknown,
  {
    visitorId: string | null;
    route: RouteType;
    room?: string;
  },
  unknown
>;

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
  route: string;
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
  } else {
    fetch(url, { body, method: "POST", keepalive: true })
      .then((res) => res.json() as Promise<{ visitorId: string }>)
      .then(({ visitorId }) => {
        setVisitorId(visitorId);
        log("useTrackPageView", {
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