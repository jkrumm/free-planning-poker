// below is a WIP to send web vitals to the server

/* import throttle from "just-throttle";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { api } from "fpp/utils/api";
import { type WebVitalMetric } from "fpp/server/api/routers/tracking";
import { useReportWebVitals } from "next/web-vitals";
import { type Metric } from "web-vitals/src/types/base";

export const useWebVitals = () => {
  const mutation = api.tracking.reportWebVitals.useMutation();
  const router = useRouter();
  const routeRef = useRef<string>(router.route ?? "");
  const [batch, setBatch] = useState<WebVitalMetric[]>([]);

  useEffect(() => {
    router.events.on("routeChangeComplete", (url: string) => {
      routeRef.current = url;
      sendVital();
    });
  }, [router.events]);

  const addToBatch = useCallback((metric: Metric) => {
    setBatch((oldBatch) => [
      ...oldBatch,
      {
        id: metric.id,
        name: metric.name,
        value: metric.value,
        route: routeRef.current,
      },
    ]);
  }, []);

  const sendVital = useCallback(() => {
    if (routeRef.current && batch.length > 0) {
      console.log("sendVital", batch);
      mutation.mutate({ batch });
      setBatch([]);
    }
  }, [batch, mutation]);

  useEffect(() => {
    const t = throttle(sendVital, 500);
    if (batch.length > 0) {
      t();
    }
  }, [batch, sendVital]);

  useReportWebVitals(addToBatch);

  useEffect(() => {
    const sendLastBatch = () => {
      console.log("sendLastBatch", batch.length);
      if (routeRef.current && batch.length > 0) {
        mutation.mutate({ batch });
      }
    };
    window.addEventListener("beforeunload", sendLastBatch);

    return () => {
      window.removeEventListener("beforeunload", sendLastBatch);
    };
  }, []);
}; */
