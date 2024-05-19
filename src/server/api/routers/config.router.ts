import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';
import { Redis } from '@upstash/redis';
import { sql } from 'drizzle-orm';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';
import { FeatureFlagType, featureFlags } from 'fpp/server/db/schema';

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL_ROOM_STATE,
  token: env.UPSTASH_REDIS_REST_TOKEN_ROOM_STATE,
});

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
    let latestTag: string | null = null;

    // TODO: improve by combining the two redis calls into one

    const redisLatestCommitSha = await redis.get(
      `${env.NEXT_PUBLIC_NODE_ENV}:latestCommitSha`,
    );

    // Validate if the latest redis commit sha is the same as the current one to not fetch the latest tag from GitHub
    if (
      redisLatestCommitSha &&
      redisLatestCommitSha === env.VERCEL_GIT_COMMIT_SHA
    ) {
      latestTag = await redis.get('latestTag');
    }

    // Fetch the latest tag from GitHub if the redis commit sha is not the same as the current one or latestTag is null
    if (!latestTag) {
      await fetch(
        'https://api.github.com/repos/jkrumm/free-planning-poker/tags',
      ).then(async (res) =>
        res
          .json()
          .then(async (res: { name: string }[]) => {
            console.log('res', res);

            latestTag = res[0]!.name;

            if (!latestTag) {
              throw new Error('no latest tag found');
            }

            // Persist the latest tag and commit sha in redis
            await redis.set('latestTag', latestTag);
            await redis.set(
              `${env.NEXT_PUBLIC_NODE_ENV}:latestCommitSha`,
              env.VERCEL_GIT_COMMIT_SHA,
            );

            console.warn('fetched latest tag', {
              redisLatestCommitSha,
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
                redisLatestCommitSha,
                commitSha: env.VERCEL_GIT_COMMIT_SHA,
                nodeEnv: env.NEXT_PUBLIC_NODE_ENV,
              },
            });
          }),
      );
    }

    // Fallback if latestTag is still null
    return latestTag ?? '5.0.0';
  }),
});
