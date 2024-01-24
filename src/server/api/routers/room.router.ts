import { type PlanetScaleDatabase } from 'drizzle-orm/planetscale-serverless/driver';
import { eq, or } from 'drizzle-orm/sql/expressions/conditions';
import { nanoid } from 'nanoid';
import { type AxiomRequest } from 'next-axiom';
import { z } from 'zod';

import { isValidMediumint } from 'fpp/utils/number.utils';
import { generateRoomNumber } from 'fpp/utils/room-number.util';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';
import {
  EventType,
  type IRoom,
  RoomEvent,
  events,
  rooms,
  users,
} from 'fpp/server/db/schema';

import { getUserPayload } from 'fpp/pages/api/track-page-view';

const findOpenRoomNumber = async (
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  db: PlanetScaleDatabase<typeof import('../../db/schema')>,
) => {
  let retries = 0;
  while (true) {
    const number = generateRoomNumber();
    const room = await db.query.rooms.findFirst({
      where: eq(rooms.number, number),
    });
    if (!room) {
      return number;
    }
    console.warn('Room number collision, trying again', { retries });
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
        userId: z.string().nullable(),
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

        if (!validateNanoId(userId)) {
          userId = nanoid();
          const userPayload = getUserPayload(req as AxiomRequest);
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
            userId: userId!,
            event,
          });
          await db
            .update(rooms)
            .set({
              lastUsedAt: new Date(),
            })
            .where(eq(rooms.id, room.id));
          return {
            userId: userId!,
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
              /.*Duplicate.*rooms_number_unique_idx.*/.test(error.message) // NOSONAR
            ) {
              retryCount++;

              if (retryCount > 10) {
                throw new Error(
                  'Failed to find open room number after 10 tries',
                );
              }

              roomNumber = await findOpenRoomNumber(db);
              console.warn('Room number collision', {
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
          userId: userId!,
          event,
        });

        return {
          userId: userId!,
          roomId: room!.id,
          roomNumber: room!.number,
          roomName: room!.name,
        };
      },
    ),
});
