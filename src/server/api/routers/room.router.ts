import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { z } from "zod";
import {
  events,
  EventType,
  type IRoom,
  RoomEvent,
  rooms,
  users,
} from "fpp/server/db/schema";
import { eq, or } from "drizzle-orm/sql/expressions/conditions";
import { generateRoomNumber } from "fpp/utils/room-number.util";
import { type PlanetScaleDatabase } from "drizzle-orm/planetscale-serverless/driver";

import type * as schema from "/Users/jkrumm/SourceRoot/free-planning-poker/src/server/db/schema";
import { getVisitorPayload } from "fpp/pages/api/track-page-view";
import { type AxiomRequest } from "next-axiom";
import { nanoid } from "nanoid";
import { isValidMediumint } from "fpp/utils/number.utils";

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
        queryRoom: z.string().max(15).min(2).toLowerCase().trim(),
        userId: z.string().length(21).nullable(),
        roomEvent: z.enum([
          RoomEvent.ENTERED_ROOM_DIRECTLY,
          RoomEvent.ENTERED_RECENT_ROOM,
          RoomEvent.ENTERED_RANDOM_ROOM,
        ]),
      }),
    )
    .mutation(
      async ({ ctx: { req, db }, input: { queryRoom, userId, roomEvent } }) => {
        let room: IRoom | undefined;

        if (!userId) {
          userId = nanoid();
          const userPayload = getVisitorPayload(req as AxiomRequest);
          await db.insert(users).values({
            id: userId,
            ...userPayload,
          });
        }

        if (isValidMediumint(queryRoom)) {
          room = await db.query.rooms.findFirst({
            where: or(
              eq(rooms.name, queryRoom),
              eq(rooms.number, Number(queryRoom)),
            ),
          });
        } else {
          room = await db.query.rooms.findFirst({
            where: eq(rooms.name, queryRoom),
          });
        }

        if (room) {
          const event: keyof typeof EventType =
            roomEvent === RoomEvent.ENTERED_ROOM_DIRECTLY
              ? EventType.ENTERED_EXISTING_ROOM
              : roomEvent;
          await db.insert(events).values({
            userId,
            event,
          });
          return {
            userId,
            roomId: room.id,
            roomNumber: room.number,
            roomName: room.name,
          };
        }

        let roomNumber = isValidMediumint(queryRoom)
          ? Number(queryRoom)
          : await findOpenRoomNumber(db);
        let retryCount = 0;

        const recursiveInsert = async () => {
          try {
            const insertId = Number(
              (
                await db.insert(rooms).values({
                  number: roomNumber,
                  name: queryRoom,
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
              retryCount++;

              if (retryCount > 10) {
                throw new Error(
                  "Failed to find open room number after 10 tries",
                );
              }

              roomNumber = await findOpenRoomNumber(db);
              console.warn("Room number collision", {
                roomNumber,
                retryCount,
              });
              await recursiveInsert();
            } else {
              throw error;
            }
          }
        };

        if (!room) {
          await recursiveInsert();
        }

        const event: keyof typeof EventType =
          roomEvent === RoomEvent.ENTERED_ROOM_DIRECTLY
            ? EventType.ENTERED_NEW_ROOM
            : roomEvent;
        await db.insert(events).values({
          userId,
          event,
        });

        return {
          userId,
          roomId: room!.id,
          roomNumber: room!.number,
          roomName: room!.name,
        };
      },
    ),
});
