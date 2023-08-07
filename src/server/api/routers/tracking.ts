import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { z } from "zod";
import { EventType, RouteType, type Visitor } from "@prisma/client";
import { DateTime } from "luxon";
import { prepareSessionData } from "fpp/utils/prepare-session-data";

export const trackingRouter = createTRPCRouter({
  trackPageView: publicProcedure
    .input(
      z.object({
        visitorId: z.string().uuid().nullable(),
        route: z.nativeEnum(RouteType),
        room: z.string().min(2).max(15).optional(),
      })
    )
    .mutation(async ({ ctx, input: { visitorId, route, room } }) => {
      let visitor: Visitor | null = null;

      if (visitorId) {
        visitor = await ctx.prisma.visitor.findUnique({
          where: { id: visitorId },
        });
      }

      if (visitor) {
        return (
          await ctx.prisma.visitor.update({
            where: { id: visitor.id },
            data: {
              pageViews: {
                create: { route, room },
              },
            },
          })
        ).id;
      }

      const sessionData = await prepareSessionData(ctx.req);
      if (sessionData.city === "Santa Clara") {
        return "we ignore next.js deployment validation";
      }

      return (
        await ctx.prisma.visitor.create({
          data: {
            ...sessionData,
            pageViews: {
              create: { route, room },
            },
          },
        })
      ).id;
    }),
  trackEvent: publicProcedure
    .input(
      z.object({
        visitorId: z.string().uuid().nullable(),
        type: z.nativeEnum(EventType),
      })
    )
    .mutation(async ({ ctx, input: { visitorId, type } }) => {
      let visitor: Partial<Visitor> | null = null;

      if (visitorId) {
        visitor = await ctx.prisma.visitor.findUnique({
          where: { id: visitorId },
        });
      }

      if (visitor) {
        return (
          await ctx.prisma.visitor.update({
            where: { id: visitor.id },
            data: {
              events: {
                create: { type },
              },
            },
          })
        ).id;
      }

      return (
        await ctx.prisma.visitor.create({
          data: {
            ...(await prepareSessionData(ctx.req)),
            events: {
              create: { type },
            },
          },
        })
      ).id;
    }),
  getPageViews: publicProcedure.query<PageViews>(async ({ ctx }) => {
    const total = await ctx.prisma.pageView.count();
    const unique = await ctx.prisma.visitor.count();
    const viewsPerVisit = Math.ceil((total / unique) * 100) / 100;

    // TODO: enable below one ISR is enabled
    /* const activities = await ctx.prisma.$queryRaw<
      { visitorId: string; activityAt: Date }[]
    >`
        SELECT visitorId, viewedAt as activityAt
        FROM PageView
        UNION ALL
        SELECT visitorId, occurredAt as activityAt
        FROM Event
        ORDER BY visitorId, activityAt;
    `;

    let totalDuration = 0;
    let totalActivities = 0;
    let currentVisitorId = null;
    let currentSessionStart = null;

    for (const activity of activities) {
      if (
        !currentVisitorId ||
        currentVisitorId !== activity.visitorId ||
        !currentSessionStart
      ) {
        totalActivities++;
        currentVisitorId = activity.visitorId;
        currentSessionStart = activity.activityAt;
      } else {
        const duration =
          activity.activityAt.getTime() - currentSessionStart.getTime();
        if (duration <= 10 * 60 * 1000) {
          totalDuration += duration;
          currentSessionStart = activity.activityAt;
        } else {
          totalDuration += 15 * 1000;
          totalActivities++;
          currentVisitorId = null;
        }
      }
    }

    const averageDuration =
      Math.ceil((totalDuration / (totalActivities || 1) / (60 * 1000)) * 100) /
      100; */

    const duration = 0;

    const visitorsWhoVotedRes = await ctx.prisma.$queryRaw<
      { hasVoted: string }[]
    >`
    SELECT COUNT(*) as hasVoted
    FROM (
      SELECT visitorId
      FROM Event
      WHERE type = "VOTED"
      GROUP BY visitorId
    ) subQuery`;
    const visitorsWhoVoted = parseInt(visitorsWhoVotedRes[0]?.hasVoted ?? "0");
    const bounceRate = 100 - Math.ceil((visitorsWhoVoted / unique) * 100);

    const totalViews = await ctx.prisma.$queryRaw<
      {
        date: Date;
        count: string;
      }[]
    >`SELECT DATE(viewedAt) AS date, COUNT(*) AS count 
        FROM PageView 
        GROUP BY date 
        ORDER BY date DESC;`;

    const uniqueViews = await ctx.prisma.$queryRaw<
      {
        date: Date;
        count: string;
      }[]
    >`SELECT DATE(startedAt) AS date, COUNT(*) AS count
        FROM Visitor
        GROUP BY date
        ORDER BY date DESC;`;

    const totalVotes = await ctx.prisma.$queryRaw<
      { date: Date; count: string }[]
    >`
        SELECT DATE(occurredAt) AS date, COUNT(*) AS count
        FROM Event
        WHERE type = "VOTED"
        GROUP BY date
        ORDER BY date DESC;`;

    return {
      stats: {
        total,
        unique,
        avgPerDay: Math.ceil(total / totalViews.length),
        viewsPerVisit,
        duration,
        bounceRate,
      },
      totalViews: totalViews.map((i) => ({
        date: DateTime.fromJSDate(i.date).toISODate()!,
        count: parseInt(i.count),
      })),
      uniqueViews: uniqueViews.map((i) => ({
        date: DateTime.fromJSDate(i.date).toISODate()!,
        count: parseInt(i.count),
      })),
      totalVotes: totalVotes.map((i) => ({
        date: DateTime.fromJSDate(i.date).toISODate()!,
        count: parseInt(i.count),
      })),
    };
  }),
  getAggregatedVisitorInfo: publicProcedure.query<AggregatedVisitorInfo>(
    async ({ ctx }) => {
      const deviceCounts = await ctx.prisma.visitor.groupBy({
        by: ["device"],
        where: {
          device: {
            not: null,
          },
        },
        _count: true,
      });

      const osCounts = await ctx.prisma.visitor.groupBy({
        by: ["os"],
        where: {
          os: {
            not: null,
          },
        },
        _count: true,
      });

      const browserCounts = await ctx.prisma.visitor.groupBy({
        by: ["browser"],
        where: {
          browser: {
            not: null,
          },
        },
        _count: true,
      });

      const countryCounts = await ctx.prisma.visitor.groupBy({
        by: ["country"],
        where: {
          country: {
            not: null,
          },
        },
        _count: true,
      });

      const regionCounts = await ctx.prisma.visitor.groupBy({
        by: ["region"],
        where: {
          region: {
            not: null,
          },
        },
        _count: true,
      });

      const cityCounts = await ctx.prisma.visitor.groupBy({
        by: ["city"],
        where: {
          city: {
            not: null,
          },
        },
        _count: true,
      });

      return {
        deviceCounts: mapCounts(deviceCounts),
        osCounts: mapCounts(osCounts),
        browserCounts: mapCounts(browserCounts),
        countryCounts: mapCounts(countryCounts),
        regionCounts: mapCounts(regionCounts),
        cityCounts: mapCounts(cityCounts),
      };
    }
  ),
});

type CountData = Record<string, string | number | null>;

const mapCounts = (data: Array<CountData>) => {
  return data
    .filter((item) => Object.values(item)[0] !== null)
    .map((item) => {
      const name = Object.values(item).find(
        (value) => value !== item._count
      ) as string;
      const value = item._count as number;
      return { name, value };
    });
};

export type CountResult = Array<{ name: string; value: number }>;

export interface AggregatedVisitorInfo {
  deviceCounts: CountResult;
  osCounts: CountResult;
  browserCounts: CountResult;
  countryCounts: CountResult;
  regionCounts: CountResult;
  cityCounts: CountResult;
}

export interface PageViews {
  stats: {
    total: number;
    unique: number;
    avgPerDay: number;
    viewsPerVisit: number;
    duration: number;
    bounceRate: number;
  };
  totalViews: { date: string; count: number }[];
  uniqueViews: { date: string; count: number }[];
  totalVotes: { date: string; count: number }[];
}
