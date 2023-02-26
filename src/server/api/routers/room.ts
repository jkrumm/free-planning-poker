import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { DateTime } from "luxon";
import randomWords from "random-words";
import { z } from "zod";

export const roomRouter = createTRPCRouter({
  getRoomList: publicProcedure.query(async ({ ctx }) => {
    const usedRooms = (
      (await ctx.prisma.room.findMany({
        where: {
          lastUsed: {
            gte: DateTime.now().minus({ week: 1 }).toJSDate(),
          },
        },
      })) || []
    ).map((item) => item.name);
    return randomWords({ exactly: 500, maxLength: 7 }).filter(
      (item) => !usedRooms.includes(item)
    );
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
    .input(z.object({ roomName: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.room.upsert({
        where: {
          name: input.roomName,
        },
        create: {
          name: input.roomName,
          lastUsed: DateTime.now().toJSDate(),
        },
        update: {
          lastUsed: DateTime.now().toJSDate(),
        },
      });
    }),
});
