import { startTransition, useEffect, useState } from 'react';

import { api } from 'fpp/utils/api';

import { useConfigStore } from 'fpp/store/config.store';

import { FeatureFlagType } from 'fpp/server/db/schema';

export const useConfigLoader = () => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setHasMounted(true);
    });
  }, []);

  const setFeatureFlags = useConfigStore((state) => state.setFeatureFlags);

  const { data: featureFlags, status: statusGetFeatureFlag } =
    api.config.getFeatureFlags.useQuery(undefined, {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
      enabled: hasMounted,
    });

  const setLatestTag = useConfigStore((state) => state.setLatestTag);

  const { data: latestTag, status: statusGetLatestTag } =
    api.config.getLatestTag.useQuery(undefined, {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
      enabled: hasMounted,
    });

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    startTransition(() => {
      if (statusGetFeatureFlag === 'success') {
        setFeatureFlags(featureFlags);
      } else if (statusGetFeatureFlag === 'error') {
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
  }, [
    hasMounted,
    statusGetFeatureFlag,
    statusGetLatestTag,
    featureFlags,
    latestTag,
    setFeatureFlags,
    setLatestTag,
  ]);

  return {
    isLoading:
      !hasMounted ||
      statusGetFeatureFlag === 'pending' ||
      statusGetLatestTag === 'pending',
    isReady:
      hasMounted &&
      statusGetFeatureFlag !== 'pending' &&
      statusGetLatestTag !== 'pending',
  };
};
