import { create } from 'zustand';

import { FeatureFlagType } from 'fpp/server/db/schema';

type ConfigStore = {
  latestTag: string;
  setLatestTag: (tag: string) => void;
  featureFlags: {
    name: keyof typeof FeatureFlagType;
    enabled: boolean;
  }[];
  setFeatureFlags: (
    featureFlags: {
      name: keyof typeof FeatureFlagType;
      enabled: boolean;
    }[],
  ) => void;
  activeFeatureFlags: string[];
};

export const useConfigStore = create<ConfigStore>((set) => ({
  latestTag: '3.0.2',
  setLatestTag: (tag: string) => set({ latestTag: tag }),
  featureFlags: Object.keys(FeatureFlagType).map((name) => ({
    name: name as keyof typeof FeatureFlagType,
    enabled: false,
  })),
  setFeatureFlags: (
    featureFlags: {
      name: keyof typeof FeatureFlagType;
      enabled: boolean;
    }[],
  ) =>
    set({
      featureFlags,
      activeFeatureFlags: featureFlags
        .filter((flag) => flag.enabled)
        .map((flag) => flag.name),
    }),
  activeFeatureFlags: [],
}));
