import { useEffect } from "react";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { type RouteType } from "@prisma/client";
import { log } from "fpp/utils/console-log";
import { type MutateFunction } from "@tanstack/query-core";

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

export const useTrackPageView = (
  route: RouteType,
  trackPageViewMutation: TrackPageViewMutation,
  room?: string
) => {
  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);

  useEffect(() => {
    void trackPageViewMutation(
      { visitorId, route, room },
      {
        onSuccess: (visitorId) => {
          setVisitorId(visitorId);
          log("useTrackPageView", {
            visitorId,
            route,
            room,
          });
        },
      }
    );
  }, [route, room]);
};
