import { env } from 'fpp/env';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';

export type SentryIssuesResponse = {
  firstSeen: string;
  lastSeen: string;
  count: number;
  userCount: number;
  title: string;
  permalink: string;
  stats: number[]; // Array of arrays: [[timestamp, count], [timestamp, count], ...]
  type: string;
};

export const sentryRouter = createTRPCRouter({
  getIssues: publicProcedure.query(async ({ ctx }) => {
    return await fetch(
      `https://sentry.io/api/0/projects/free-planning-poker/free-planning-poker/issues/?statsPeriod=14d`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.SENTRY_API_KEY}`,
        },
        signal: AbortSignal.timeout(7000),
      },
    ).then(async (res) => {
      const issues = (await res.json()) as {
        firstSeen: string;
        lastSeen: string;
        count: string;
        userCount: number;
        permalink: string;
        stats: { '14d': number[][] };
        metadata: { type: string; value: string };
      }[];
      const mappedIssues: SentryIssuesResponse[] = issues.map((issue) => ({
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
        count: Number(issue.count),
        userCount: issue.userCount,
        title: issue.metadata.value,
        permalink: issue.permalink,
        stats: issue.stats['14d'].map((stat) => Number(stat[1])),
        type: issue.metadata.type,
      }));

      // Sort by count (descending) and then by lastSeen (descending)
      return mappedIssues.sort((a, b) => {
        // First sort by count (descending)
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        // If counts are equal, sort by lastSeen (descending)
        return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
      });
    });
  }),
});
