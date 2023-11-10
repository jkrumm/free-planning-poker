import { useFeatureFlagStore } from "fpp/store/feature-flag.store";
import { useEffect } from "react";
import { FeatureFlagType } from "fpp/server/db/schema";
import * as Sentry from "@sentry/nextjs";
import { logMsg } from "fpp/constants/logging.constant";

export const FeatureFlagLoaderUtil = () => {
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

  return <></>;
};
