import { startTransition, useEffect, useState } from 'react';

import { api } from 'fpp/utils/api';
import { addBreadcrumb, captureError } from 'fpp/utils/app-error';

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

  const {
    data: featureFlags,
    status: statusGetFeatureFlag,
    error: featureFlagsError,
  } = api.config.getFeatureFlags.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
    enabled: hasMounted,
  });

  const setLatestTag = useConfigStore((state) => state.setLatestTag);

  const {
    data: latestTag,
    status: statusGetLatestTag,
    error: latestTagError,
  } = api.config.getLatestTag.useQuery(undefined, {
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
      try {
        if (statusGetFeatureFlag === 'success') {
          setFeatureFlags(featureFlags);
          addBreadcrumb('Feature flags loaded successfully', 'config', {
            count: featureFlags?.length || 0,
          });
        } else if (statusGetFeatureFlag === 'error') {
          const fallbackFlags = Object.keys(FeatureFlagType).map((name) => ({
            name: name as keyof typeof FeatureFlagType,
            enabled: false,
          }));

          setFeatureFlags(fallbackFlags);

          captureError(
            featureFlagsError || 'Failed to load feature flags',
            {
              component: 'useConfigLoader',
              action: 'loadFeatureFlags',
              extra: {
                fallbackCount: fallbackFlags.length,
                status: statusGetFeatureFlag,
              },
            },
            'medium',
          );

          addBreadcrumb('Feature flags fallback applied', 'config', {
            fallbackCount: fallbackFlags.length,
          });
        }

        if (statusGetLatestTag === 'success') {
          setLatestTag(latestTag);
          addBreadcrumb('Latest tag loaded successfully', 'config', {
            tag: latestTag || 'none',
          });
        } else if (statusGetLatestTag === 'error') {
          captureError(
            latestTagError || 'Failed to load latest tag',
            {
              component: 'useConfigLoader',
              action: 'loadLatestTag',
              extra: {
                status: statusGetLatestTag,
              },
            },
            'low', // Less critical than feature flags
          );
        }
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Unknown error in config loader'),
          {
            component: 'useConfigLoader',
            action: 'processConfigData',
            extra: {
              featureFlagStatus: statusGetFeatureFlag,
              latestTagStatus: statusGetLatestTag,
            },
          },
          'high',
        );
      }
    });
  }, [
    hasMounted,
    statusGetFeatureFlag,
    statusGetLatestTag,
    featureFlags,
    latestTag,
    featureFlagsError,
    latestTagError,
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
