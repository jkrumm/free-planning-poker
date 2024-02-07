import { startTransition, useEffect } from 'react';

import { api } from 'fpp/utils/api';

import { useConfigStore } from 'fpp/store/config.store';

import { FeatureFlagType } from 'fpp/server/db/schema';

export const useConfigLoader = () => {
  const setFeatureFlags = useConfigStore((state) => state.setFeatureFlags);

  const { data: featureFlags, status: statusGetFeatureFlag } =
    api.config.getFeatureFlags.useQuery(undefined, {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    });

  const setLatestTag = useConfigStore((state) => state.setLatestTag);

  const { data: latestTag, status: statusGetLatestTag } =
    api.config.getLatestTag.useQuery(undefined, {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    });

  useEffect(() => {
    startTransition(() => {
      if (statusGetFeatureFlag === 'success') {
        setFeatureFlags(featureFlags);
      } else {
        setFeatureFlags(
          Object.keys(FeatureFlagType).map((name) => ({
            name: name as keyof typeof FeatureFlagType,
            enabled: false,
          })),
        );
      }
      if (statusGetLatestTag === 'success') {
        setLatestTag(latestTag);
      }
    });
  }, [statusGetFeatureFlag, statusGetLatestTag]);
};
