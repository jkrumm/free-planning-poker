import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { featureFlags, FeatureFlagType } from "fpp/server/db/schema";
import { sql } from "drizzle-orm";

export const featureFlagRouter = createTRPCRouter({
  getFeatureFlags: publicProcedure.query(async ({ ctx: { db } }) => {
    const activeFeatureFlags = (
      await db
        .select({ name: featureFlags.name })
        .from(featureFlags)
        .where(sql`${featureFlags.enabled} = 1`)
    ).map((row) => row.name);

    return Object.keys(FeatureFlagType).map((name) => ({
      name: name as keyof typeof FeatureFlagType,
      enabled: activeFeatureFlags.includes(name),
    }));
  }),
});
