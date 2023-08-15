import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { DateTime } from "luxon";
import { generate } from "random-words";
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
      const filtered = generate({
        minLength: 3,
        maxLength: i,
        exactly: 400,
      }).filter((item) => !usedRooms.includes(item));
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
      try {
        // const deletedRoom = await ctx.prisma.room.findFirst({
        //   where: {
        //     name: input.room,
        //   },
        // });
        // const name = deletedRoom?.name;

        const room = await ctx.prisma.room.findFirst({
          where: {
            name: input.room,
          },
        });
        if (room) {
          await ctx.prisma.room.update({
            where: {
              name: input.room,
            },
            data: {
              lastUsed: DateTime.now().toJSDate(),
            },
          });
        } else {
          await ctx.prisma.room.create({
            data: {
              name: input.room,
              lastUsed: DateTime.now().toJSDate(),
            },
          });
        }
      } catch (e) {
        // TODO: sentry
        console.error(e);
      }
      return input.room;
    }),
});
