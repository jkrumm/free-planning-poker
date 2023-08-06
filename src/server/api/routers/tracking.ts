import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { z } from "zod";
import UAParser from "ua-parser-js";
import { lookup } from "geoip-lite";
import { EventType, RouteType, type Visitor } from "@prisma/client";
import requestIp from "request-ip";
import { type NextApiRequest } from "next";
import { DateTime } from "luxon";

function prepareSessionData(req: NextApiRequest): Partial<Visitor> {
  const ua = UAParser(req.headers["user-agent"]);

  let ip = requestIp.getClientIp(req);
  if (!ip || ip === "::1") {
    ip = req.connection.remoteAddress ?? null;
  }

  let geo = null;
  if (ip) {
    geo = lookup(ip);
  }

  return {
    device: ua.device.type ?? "desktop",
    os: ua.os.name ?? null,
    browser: ua.browser.name ?? null,
    country: geo?.country ?? null,
    region: geo?.region ?? null,
    city: geo?.city ?? null,
  };
}

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
      const visitorData = prepareSessionData(ctx.req);
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
              ...visitorData,
              pageViews: {
                create: { route, room },
              },
            },
          })
        ).id;
      }

      return (
        await ctx.prisma.visitor.create({
          data: {
            ...visitorData,
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
      const visitorData = prepareSessionData(ctx.req);
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
              ...visitorData,
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
            ...visitorData,
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

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    /* const durationRes = (await ctx.prisma.$queryRaw`
  SELECT AVG(duration) as avgDuration
  FROM (
    SELECT visitorId, MAX(viewedAtOrOccurredAt) - MIN(viewedAtOrOccurredAt) as duration
    FROM (
      SELECT visitorId, viewedAt as viewedAtOrOccurredAt
      FROM PageView
      UNION ALL
      SELECT visitorId, occurredAt as viewedAtOrOccurredAt
      FROM Event
    ) subQuery
    GROUP BY visitorId
    HAVING duration <= INTERVAL '10 minutes'
  ) durationQuery`) as { avgDuration: string }[];
    const duration = parseInt(durationRes[0]?.avgDuration ?? "0");*/

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const visitorsWhoVotedRes = (await ctx.prisma.$queryRaw`
    SELECT COUNT(*) as hasVoted
    FROM (
      SELECT visitorId
      FROM Event
      WHERE type = "VOTED"
      GROUP BY visitorId
    ) subQuery`) as { hasVoted: string }[];
    const visitorsWhoVoted = parseInt(visitorsWhoVotedRes[0]?.hasVoted ?? "0");
    const bounceRate = 100 - Math.ceil((visitorsWhoVoted / unique) * 100);

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const totalViews = (await ctx.prisma
      .$queryRaw`SELECT DATE(viewedAt) AS date, COUNT(*) AS count 
        FROM PageView 
        GROUP BY date 
        ORDER BY date DESC;`) as {
      date: Date;
      count: string;
    }[];

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const uniqueViews = (await ctx.prisma
      .$queryRaw`SELECT DATE(startedAt) AS date, COUNT(*) AS count
        FROM Visitor
        GROUP BY date
        ORDER BY date DESC;`) as {
      date: Date;
      count: string;
    }[];

    return {
      stats: {
        total,
        unique,
        avgPerDay: 0,
        viewsPerVisit,
        duration: 0,
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
    };
  }),
});

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
}
