import { env } from 'fpp/env';

import { TRPCError } from '@trpc/server';

import * as Sentry from '@sentry/nextjs';
import { type MySql2Database } from 'drizzle-orm/mysql2/driver';
import { eq, or } from 'drizzle-orm/sql/expressions/conditions';
import { RoomServer } from 'fpp-server/src/room.entity';
import { type RoomDto } from 'fpp-server/src/room.types';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { isValidMediumint } from 'fpp/utils/number.utils';
import { generateRoomNumber } from 'fpp/utils/room-number.util';
import { getICreateVoteFromRoomState } from 'fpp/utils/room.util';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';
import {
  EventType,
  type IRoom,
  RoomEvent,
  estimations,
  events,
  rooms,
  users,
  votes,
} from 'fpp/server/db/schema';

import { getUserPayload } from 'fpp/pages/api/track-page-view';

const findOpenRoomNumber = async (
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  db: MySql2Database<typeof import('../../db/schema')>,
) => {
  let retries = 0;
  while (true) {
    const number = generateRoomNumber();
    const room = await db.query.rooms.findFirst({
      where: or(eq(rooms.number, number), eq(rooms.name, String(number))),
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
  getRoomStats: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
      }),
    )
    .query(async ({ ctx: { db }, input: { roomId } }) => {
      // Validate room exists
      const room = await db.query.rooms.findFirst({
        where: eq(rooms.id, roomId),
      });
      if (!room) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Room not found',
        });
      }

      // Fetch room stats from analytics service
      return (await fetch(`${env.ANALYTICS_URL}/room/${roomId}/stats`, {
        headers: {
          Authorization: env.ANALYTICS_SECRET_TOKEN,
        },
      })
        .then((res) => res.json())
        .catch((e) => {
          console.error('Error fetching room stats', e);
          Sentry.captureException(e, {
            extra: {
              roomId,
            },
            tags: {
              endpoint: logEndpoint.GET_ANALYTICS,
            },
          });
        })) as {
        votes: number;
        duration: number;
        estimations: number;
        estimations_per_vote: number;
        avg_min_estimation: number;
        avg_avg_estimation: number;
        avg_max_estimation: number;
        spectators: number;
        spectators_per_vote: number;
      };
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
          const userPayload = await getUserPayload(req);
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
            const insert = await db.insert(rooms).values({
              number: roomNumber,
              name: queryRoom,
            });
            const insertId = Number(insert[0].insertId);
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
  updateRoomName: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        roomId: z.number(),
        newRoomName: z.string().max(15).min(3).toLowerCase().trim(),
      }),
    )
    .mutation(
      async ({ ctx: { db }, input: { userId, roomId, newRoomName } }) => {
        if (!db) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Cannot change room name without a database connection`,
          });
        }

        // Validate room exists
        const existingRoom = await db.query.rooms.findFirst({
          where: eq(rooms.id, roomId),
        });

        if (!existingRoom) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Room not found',
          });
        }

        if (existingRoom.name === newRoomName) {
          return {
            roomId: existingRoom.id,
            roomNumber: existingRoom.number,
            roomName: existingRoom.name,
          };
        }

        // Check if new name is already taken
        const isNumericName = !isNaN(Number(newRoomName));

        let conflictingRoom: IRoom | undefined;

        if (isNumericName) {
          conflictingRoom = await db.query.rooms.findFirst({
            where: or(
              eq(rooms.name, newRoomName),
              eq(rooms.number, Number(newRoomName)),
            ),
          });
        } else {
          // For non-numeric names, only check name field
          conflictingRoom = await db.query.rooms.findFirst({
            where: eq(rooms.name, newRoomName),
          });
        }

        if (conflictingRoom && conflictingRoom.id !== roomId) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Room name already exists',
          });
        }

        // Update room name
        await db
          .update(rooms)
          .set({
            name: newRoomName,
            lastUsedAt: new Date(),
          })
          .where(eq(rooms.id, roomId));

        // Track the room name change event
        await db.insert(events).values({
          userId,
          event: EventType.CHANGED_ROOM_NAME,
        });

        return {
          roomId,
          roomNumber: existingRoom.number,
          roomName: newRoomName,
        };
      },
    ),
  trackFlip: publicProcedure
    .input(
      z.object({
        roomState: z.string(),
        roomId: z.number(),
        fppServerSecret: z.string(),
      }),
    )
    .mutation(
      async ({
        ctx: { db },
        input: { roomId, roomState, fppServerSecret },
      }) => {
        if (fppServerSecret !== env.FPP_SERVER_SECRET) {
          throw new TRPCError({
            message: `Invalid fpp-server secret`,
            code: 'UNAUTHORIZED',
          });
        }

        if (!db) {
          throw new TRPCError({
            message: `Cannot flip without a database connection`,
            code: 'INTERNAL_SERVER_ERROR',
          });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const promises: Promise<any>[] = [];

        const roomStateDto = JSON.parse(roomState) as RoomDto;

        const roomStateServer = RoomServer.fromJson(roomStateDto);

        promises.push(
          db.insert(votes).values(getICreateVoteFromRoomState(roomStateServer)),
        );
        for (const user of roomStateServer.users) {
          promises.push(
            db.insert(estimations).values({
              userId: user.id,
              roomId,
              estimation: user.estimation,
              spectator: user.isSpectator,
            }),
          );
        }
        promises.push(
          db
            .update(rooms)
            .set({
              lastUsedAt: new Date(),
            })
            .where(eq(rooms.id, roomId)),
        );

        await Promise.allSettled(promises).then((results) => {
          for (const result of results) {
            if (
              result.status === 'rejected' &&
              result.reason instanceof TRPCError
            ) {
              console.error('Failed to fully set room state', {
                roomId,
                error: {
                  message: result.reason.message,
                  code: result.reason.code,
                  stack: result.reason.stack,
                },
              });
            }
          }
          for (const result of results) {
            if (result.status === 'rejected') {
              throw result.reason;
            }
          }
        });
      },
    ),
});
