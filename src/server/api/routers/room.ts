import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { z } from "zod";
import { rooms } from "fpp/server/db/schema";

export const roomRouter = createTRPCRouter({
  setRoom: publicProcedure
    .input(z.object({ room: z.string().max(15).min(2).toLowerCase().trim() }))
    .mutation(async ({ ctx: { db }, input }) => {
      await db
        .insert(rooms)
        .values({
          name: input.room,
          lastUsedAt: Date.now(),
        })
        .onConflictDoUpdate({
          target: rooms.name,
          set: {
            lastUsedAt: Date.now(),
          },
        });
    }),
});
