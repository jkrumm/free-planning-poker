import { useEffect } from "react";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { type UseMutationResult } from "@tanstack/react-query";
import { type RouteType } from "@prisma/client";
import { onCLS, onFID, onLCP } from "web-vitals";

export type UseTrackPageViewMutation = UseMutationResult<
  string,
  unknown,
  { visitorId: string | null; route: RouteType; room?: string },
  unknown
>;

/* export const useTrackPageView = (
  route: RouteType,
  visitorId: string | null,
  trackPageViewMutation: UseTrackPageViewMutation,
  room?: string
) => {
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);

  const [metrics, setMetrics] = useState<{
    LCP?: number;
    FID?: number;
    CLS?: number;
  }>({});

  useEffect(() => {
    onLCP((metric) => {
      setMetrics((prev) => ({ ...prev, LCP: metric.value }));
    });

    onFID((metric) => {
      setMetrics((prev) => ({ ...prev, FID: metric.value }));
    });

    onCLS((metric) => {
      setMetrics((prev) => ({ ...prev, CLS: metric.value }));
    });
  }, []);

  useEffect(() => {
    if (metrics.LCP && metrics.FID && metrics.CLS) {
      trackPageViewMutation.mutate(
        { visitorId, route, room },
        {
          onSuccess: (visitorId) => {
            setVisitorId(visitorId);
            log("useTrackPageView", {
              visitorId,
              route,
              room,
              metrics,
            });
          },
        }
      );
    }
  }, [metrics, visitorId, route, room]);
}; */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function promiseMetric(metricFn: any) {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    metricFn((metric) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      resolve(metric.value);
    });
  });
}

export const useTrackPageView = (
  route: RouteType,
  visitorId: string | null,
  trackPageViewMutation: UseTrackPageViewMutation,
  room?: string
) => {
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    Promise.allSettled([
      promiseMetric(onLCP),
      promiseMetric(onFID),
      promiseMetric(onCLS),
    ]).then(([lcpResult, fidResult, clsResult]) => {
      if (
        lcpResult.status === "fulfilled" &&
        fidResult.status === "fulfilled" &&
        clsResult.status === "fulfilled"
      ) {
        console.log("useTrackPageView", {
          visitorId,
          route,
          room,
          LCP: lcpResult.value,
          FID: fidResult.value,
          CLS: clsResult.value,
        });
        trackPageViewMutation.mutate(
          // LCP: lcpResult.value, FID: fidResult.value, CLS: clsResult.value
          { visitorId, route, room },
          {
            onSuccess: (visitorId) => {
              setVisitorId(visitorId);
              console.log("useTrackPageView SUCCEDED", {
                visitorId,
                route,
                room,
                LCP: lcpResult.value,
                FID: fidResult.value,
                CLS: clsResult.value,
              });
            },
          }
        );
      }
    });
  }, [visitorId, route, room]);
};
