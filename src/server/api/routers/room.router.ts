import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { z } from "zod";
import { type IRoom, rooms } from "fpp/server/db/schema";
import { eq, or } from "drizzle-orm/sql/expressions/conditions";
import { generateRoomNumber } from "fpp/utils/room-number.util";
import { type PlanetScaleDatabase } from "drizzle-orm/planetscale-serverless/driver";

import type * as schema from "/Users/jkrumm/SourceRoot/free-planning-poker/src/server/db/schema";

const findOpenRoomNumber = async (db: PlanetScaleDatabase<typeof schema>) => {
  let retries = 0;
  while (true) {
    const number = generateRoomNumber();
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.number, number),
    });
    if (!room) {
      return number;
    }
    console.warn("Room number collision, trying again", { retries });
    retries++;
  }
};

export const roomRouter = createTRPCRouter({
  getOpenRoomNumber: publicProcedure.query(async ({ ctx: { db } }) => {
    return await findOpenRoomNumber(db);
  }),
  joinRoom: publicProcedure
    .input(
      z.object({
        roomReadable: z.string().max(15).min(2).toLowerCase().trim().optional(),
      }),
    )
    .mutation(async ({ ctx: { db }, input: { roomReadable } }) => {
      let room: IRoom | undefined;

      if (roomReadable) {
        room = await db.query.rooms.findFirst({
          where: or(
            eq(rooms.name, roomReadable),
            eq(rooms.number, Number(roomReadable)),
          ),
        });
      }

      if (room) {
        return {
          roomId: room.id,
          roomReadable: String(room.name ?? room.number),
          roomNumber: room.number,
          roomName: room.name,
        };
      }

      let roomNumber = !isNaN(Number(roomReadable))
        ? Number(roomReadable)
        : await findOpenRoomNumber(db);

      const recursiveInsert = async () => {
        try {
          const insertId = Number(
            (
              await db.insert(rooms).values({
                number: roomNumber,
              })
            ).insertId,
          );
          room = await db.query.rooms.findFirst({
            where: eq(rooms.id, insertId),
          });
        } catch (error) {
          if (
            error instanceof Error &&
            /.*Duplicate.*rooms_number_unique_idx.*/.test(error.message)
          ) {
            roomNumber = await findOpenRoomNumber(db);
          }
          throw error;
        }
      };

      if (!room) {
        await recursiveInsert();
      }

      return {
        roomId: room!.id,
        roomReadable: String(room!.name ?? room!.number),
        roomNumber: room!.number,
        roomName: room!.name,
      };
    }),
});
