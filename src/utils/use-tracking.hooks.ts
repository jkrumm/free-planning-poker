import { useEffect } from "react";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { type RouteType } from "@prisma/client";
import { log } from "fpp/utils/console-log";
import { env } from "fpp/env.mjs";

export type TrackPageViewMutation = (params: {
  visitorId: string | null;
  route: RouteType;
  room?: string;
}) => Promise<string>;

export const useTrackPageView = (
  route: RouteType,
  trackPageView: TrackPageViewMutation,
  room?: string
) => {
  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);

  useEffect(() => {
    if (env.NEXT_PUBLIC_NODE_ENV === "development") {
      return;
    }
    void trackPageView({ visitorId, route, room }).then((visitorId) => {
      setVisitorId(visitorId);
      log("useTrackPageView", {
        visitorId,
        route,
        room,
      });
    });
  }, [route, room]);
};
