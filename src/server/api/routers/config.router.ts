import { env } from 'fpp/env';

import { sql } from 'drizzle-orm';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { captureError } from 'fpp/utils/app-error';

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
      enabled: activeFeatureFlags.includes(
        name as keyof typeof FeatureFlagType,
      ),
    }));
  }),
  getLatestTag: publicProcedure.query(async () => {
    // Fetch the latest tag from GitHub if the redis commit sha is not the same as the current one or latestTag is null
    if (!latestTag) {
      await fetch(
        'https://api.github.com/repos/jkrumm/free-planning-poker/tags',
      )
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(
              `GitHub API error: ${res.status} ${res.statusText}`,
            );
          }
          return res.json() as Promise<{ name: string }[]>;
        })
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
          // captureError already logs to console in development mode
          captureError(
            e instanceof Error ? e : new Error('Failed to fetch latest tag'),
            {
              component: 'configRouter',
              action: 'getLatestTag',
              extra: {
                endpoint: logEndpoint.GET_LATEST_TAG,
                commitSha: env.VERCEL_GIT_COMMIT_SHA,
                nodeEnv: env.NEXT_PUBLIC_NODE_ENV,
              },
            },
            'medium',
          );
        });
    }

    // Fallback if latestTag is still null
    return latestTag ?? '8.0.0';
  }),
});
