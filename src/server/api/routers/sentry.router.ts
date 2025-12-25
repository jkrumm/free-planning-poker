import { env } from 'fpp/env';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';

export type SentryIssuesResponse = {
  id: string;
  title: string;
  permalink: string;
  firstSeen: string;
  lastSeen: string;
  count: number;
  userCount: number;
  stats: number[];
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  status: string;
  substatus: string;
  platform: string;
  issueType: string;
  issueCategory: string;
  culprit?: string;
  errorType?: string;
  errorValue?: string;
  hasSeen: boolean;
  project: string;
};

const LEVEL_PRIORITY = {
  fatal: 5,
  error: 4,
  warning: 3,
  info: 2,
  debug: 1,
} as const;

export const sentryRouter = createTRPCRouter({
  getIssues: publicProcedure.query(async ({ ctx: _ctx }) => {
    const projects = [
      'free-planning-poker',
      'fpp-server',
      'fpp-analytics',
    ] as const;

    // Fetch issues from all projects in parallel
    const allIssuesPromises = projects.map((project) =>
      fetch(
        `https://sentry.io/api/0/projects/jkrumm/${project}/issues/?statsPeriod=14d`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.SENTRY_API_KEY}`,
          },
          signal: AbortSignal.timeout(7000),
        },
      ).then(async (res) => {
        // Handle non-OK responses (404, 401, etc.) - return empty array
        if (!res.ok) {
          console.warn(
            `Sentry API error for ${project}: ${res.status} ${res.statusText}`,
          );
          return [];
        }

        const issues = (await res.json()) as {
          id: string;
          shortId: string;
          title: string;
          permalink: string;
          firstSeen: string;
          lastSeen: string;
          count: string;
          userCount: number;
          stats: { '14d': number[][] };
          level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
          status: string;
          substatus: string;
          platform: string;
          issueType: string;
          issueCategory: string;
          culprit?: string;
          hasSeen: boolean;
          metadata: {
            type?: string;
            value?: string;
            title?: string;
          };
          type: string;
        }[];

        return issues.map((issue) => {
          // Determine the best title to use
          const title =
            issue.title ??
            issue.metadata.title ??
            (issue.metadata.value && issue.metadata.type
              ? `${issue.metadata.type}: ${issue.metadata.value}`
              : issue.shortId);

          return {
            id: issue.id,
            title,
            permalink: issue.permalink,
            firstSeen: issue.firstSeen,
            lastSeen: issue.lastSeen,
            count: Number(issue.count),
            userCount: issue.userCount,
            stats: issue.stats['14d'].map((stat) => Number(stat[1])),
            level: issue.level,
            status: issue.status,
            substatus: issue.substatus,
            platform: issue.platform,
            issueType: issue.issueType,
            issueCategory: issue.issueCategory,
            culprit: issue.culprit,
            errorType: issue.metadata.type,
            errorValue: issue.metadata.value,
            hasSeen: issue.hasSeen,
            project,
          };
        });
      }),
    );

    // Wait for all requests to complete
    const allIssuesArrays = await Promise.all(allIssuesPromises);

    // Flatten all issues into a single array
    const mappedIssues: SentryIssuesResponse[] = allIssuesArrays.flat();

    // Sort by level priority first, then by count, then by lastSeen
    return mappedIssues.sort((a, b) => {
      // First sort by level priority (fatal > error > warning > info > debug)
      const levelDiff = LEVEL_PRIORITY[b.level] - LEVEL_PRIORITY[a.level];
      if (levelDiff !== 0) return levelDiff;

      // Then sort by count (descending)
      const countDiff = b.count - a.count;
      if (countDiff !== 0) return countDiff;

      // Finally, sort by lastSeen (descending)
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });
  }),
});
