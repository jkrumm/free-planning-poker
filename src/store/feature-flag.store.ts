import { create } from "zustand";
import { FeatureFlagType } from "fpp/server/db/schema";

type FeatureFlagStore = {
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

export const useFeatureFlagStore = create<FeatureFlagStore>((set, get) => ({
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
