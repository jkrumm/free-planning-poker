'use client';

import { api } from 'fpp/utils/api';

import { useFeatureFlagStore } from 'fpp/store/feature-flag.store';

import { FeatureFlagType } from 'fpp/server/db/schema';

export const FeatureFlagLoaderUtil = () => {
  const setFeatureFlags = useFeatureFlagStore((state) => state.setFeatureFlags);

  const { data: featureFlags, status } =
    api.featureFlag.getFeatureFlags.useQuery(undefined, {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    });

  if (status === 'success') {
    setFeatureFlags(featureFlags);
  } else {
    setFeatureFlags(
      Object.keys(FeatureFlagType).map((name) => ({
        name: name as keyof typeof FeatureFlagType,
        enabled: false,
      })),
    );
  }

  return <></>;
};
