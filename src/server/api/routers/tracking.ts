import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { z } from "zod";
import UAParser from "ua-parser-js";
import { lookup } from "geoip-lite";
import { EventType, RouteType, type Visitor } from "@prisma/client";
import requestIp from "request-ip";
import { type NextApiRequest } from "next";

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
});
