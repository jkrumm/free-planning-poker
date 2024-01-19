import * as Sentry from '@sentry/nextjs';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { api } from 'fpp/utils/api';

import { useConfigStore } from 'fpp/store/config.store';

import { FeatureFlagType } from 'fpp/server/db/schema';

export const useConfigLoader = () => {
  const setFeatureFlags = useConfigStore((state) => state.setFeatureFlags);

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

  const setLatestTag = useConfigStore((state) => state.setLatestTag);

  fetch('https://api.github.com/repos/jkrumm/free-planning-poker/tags')
    .then((res) => res.json())
    .then((res: { name: string }[]) => {
      setLatestTag(res[0]!.name);
    })
    .catch((e) => {
      Sentry.captureException(e, {
        tags: {
          endpoint: logEndpoint.GET_LATEST_TAG,
        },
      });
    });
};
