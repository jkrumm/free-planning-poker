import { env } from 'fpp/env';

import { logger } from 'fpp/utils/logger';

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

type SentryApiIssue = {
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
};

/**
 * Fetch issues for a single Sentry project
 */
async function fetchProjectIssues(
  project: string,
): Promise<SentryIssuesResponse[]> {
  const res = await fetch(
    `https://sentry.io/api/0/projects/jkrumm/${project}/issues/?statsPeriod=14d`,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.SENTRY_API_KEY}`,
      },
      signal: AbortSignal.timeout(7000),
    },
  );

  if (!res.ok) {
    logger.warn(
      {
        component: 'sentryRouter',
        action: 'fetchProjectIssues',
        project,
        status: res.status,
        statusText: res.statusText,
      },
      `Sentry API error for ${project}`,
    );
    return [];
  }

  const issues = (await res.json()) as SentryApiIssue[];

  return issues.map((issue) => ({
    id: issue.id,
    title:
      issue.title ??
      issue.metadata.title ??
      (issue.metadata.value && issue.metadata.type
        ? `${issue.metadata.type}: ${issue.metadata.value}`
        : issue.shortId),
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
  }));
}

export const sentryRouter = createTRPCRouter({
  getIssues: publicProcedure.query(async () => {
    const projects = ['free-planning-poker', 'fpp-server', 'fpp-analytics'];

    // Fetch issues from all projects in parallel
    const allIssuesArrays = await Promise.all(
      projects.map((project) => fetchProjectIssues(project)),
    );

    // Flatten and sort by level priority, count, then lastSeen
    return allIssuesArrays.flat().sort((a, b) => {
      const levelDiff = LEVEL_PRIORITY[b.level] - LEVEL_PRIORITY[a.level];
      if (levelDiff !== 0) return levelDiff;

      const countDiff = b.count - a.count;
      if (countDiff !== 0) return countDiff;

      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });
  }),
});
