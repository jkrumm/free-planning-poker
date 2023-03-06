import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { DateTime } from "luxon";
import randomWords from "random-words";
import { z } from "zod";

export const roomRouter = createTRPCRouter({
  getRandomRoom: publicProcedure.query(async ({ ctx }) => {
    const usedRooms = (
      (await ctx.prisma.room.findMany({
        where: {
          lastUsed: {
            gte: DateTime.now().minus({ days: 1 }).toJSDate(),
          },
        },
      })) || []
    ).map((item) => item.name);
    for (let i = 3; i <= 11; i++) {
      const filtered = randomWords({ maxLength: i, exactly: 400 }).filter(
        (item) => !usedRooms.includes(item)
      );
      if (filtered.length > 0) {
        return filtered[0];
      }
    }
  }),
  getActiveRooms: publicProcedure.query(async ({ ctx }) => {
    return (
      (await ctx.prisma.room.findMany({
        select: { name: true },
        where: {
          lastUsed: {
            gte: DateTime.now().minus({ hour: 3 }).toJSDate(),
          },
        },
      })) || []
    ).map((item) => item.name);
  }),
  setRoom: publicProcedure
    .input(z.object({ room: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.prisma.room.findUnique({
        where: {
          name: input.room,
        },
      });
      if (room) {
        ctx.prisma.room.update({
          where: {
            name: input.room,
          },
          data: {
            lastUsed: DateTime.now().toJSDate(),
          },
        });
      } else {
        ctx.prisma.room.create({
          data: {
            name: input.room,
            lastUsed: DateTime.now().toJSDate(),
          },
        });
      }
    }),
});
