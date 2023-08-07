import { useEffect } from "react";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { type UseMutationResult } from "@tanstack/react-query";
import { type RouteType } from "@prisma/client";
import { log } from "fpp/utils/console-log"; // import the store

export type UseTrackPageViewMutation = UseMutationResult<
  string,
  unknown,
  { visitorId: string | null; route: RouteType; room?: string },
  unknown
>;

export const useTrackPageView = (
  route: RouteType,
  visitorId: string | null,
  trackPageViewMutation: UseTrackPageViewMutation,
  room?: string
) => {
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);

  useEffect(() => {
    trackPageViewMutation.mutate(
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
  }, [visitorId, route, room]);
};
