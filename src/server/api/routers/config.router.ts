import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';
import { sql } from 'drizzle-orm';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';
import { FeatureFlagType, featureFlags } from 'fpp/server/db/schema';

let latestTag: string | null = null;

export const configRouter = createTRPCRouter({
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
  getLatestTag: publicProcedure.query(async () => {
    // Fetch the latest tag from GitHub if the redis commit sha is not the same as the current one or latestTag is null
    if (!latestTag) {
      await fetch(
        'https://api.github.com/repos/jkrumm/free-planning-poker/tags',
      ).then(async (res) =>
        res
          .json()
          .then(async (res: { name: string }[]) => {
            latestTag = res[0]!.name;

            if (!latestTag) {
              throw new Error('no latest tag found');
            }

            console.warn('fetched latest tag', {
              commitSha: env.VERCEL_GIT_COMMIT_SHA,
              nodeEnv: env.NEXT_PUBLIC_NODE_ENV,
              latestTag,
            });
          })
          .catch((e) => {
            console.error('failed to fetch latest tag', e);
            Sentry.captureException(e, {
              tags: {
                endpoint: logEndpoint.GET_LATEST_TAG,
              },
              extra: {
                commitSha: env.VERCEL_GIT_COMMIT_SHA,
                nodeEnv: env.NEXT_PUBLIC_NODE_ENV,
              },
            });
          }),
      );
    }

    // Fallback if latestTag is still null
    return latestTag ?? '7.0.0';
  }),
});
