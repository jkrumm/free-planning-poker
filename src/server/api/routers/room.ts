import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { DateTime } from "luxon";
import { z } from "zod";

export const roomRouter = createTRPCRouter({
  setRoom: publicProcedure
    .input(z.object({ room: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
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
