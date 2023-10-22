import { type AppType } from "next/app";

import { api } from "fpp/utils/api";

import "fpp/styles/globals.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import React, { useEffect } from "react";
import { AxiomWebVitals } from "next-axiom";
import { FeatureFlagType } from "fpp/server/db/schema";
import * as Sentry from "@sentry/nextjs";
import { logMsg } from "fpp/constants/logging.constant";
import { useFeatureFlagStore } from "fpp/store/feature-flag.store";

const MyApp: AppType = ({ Component, pageProps: { ...pageProps } }) => {
  const setFeatureFlags = useFeatureFlagStore((state) => state.setFeatureFlags);

  // Fetch feature flags
  useEffect(() => {
    void fetch(`${process.env.NEXT_PUBLIC_API_ROOT}api/get-feature-flags`)
      .then((res) =>
        res.json().then(
          (data) =>
            data as {
              name: keyof typeof FeatureFlagType;
              enabled: boolean;
            }[],
        ),
      )
      .catch(() => {
        Sentry.captureException(new Error(logMsg.GET_FEATURE_FLAGS_FAILED));
        return Object.keys(FeatureFlagType).map((name) => ({
          name: name as keyof typeof FeatureFlagType,
          enabled: false,
        }));
      })
      .then((featureFlags) => {
        setFeatureFlags(featureFlags);
      });
  }, []);

  return (
    <MantineProvider
      withNormalizeCSS
      theme={{
        colorScheme: "dark",
        loader: "bars",
      }}
      withGlobalStyles
    >
      <AxiomWebVitals />
      <Notifications position="top-right" />
      <Component {...pageProps} />
    </MantineProvider>
  );
};

export default api.withTRPC(MyApp);
