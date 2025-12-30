import { env } from 'fpp/env';

import { TRPCError } from '@trpc/server';

import { type MySql2Database } from 'drizzle-orm/mysql2/driver';
import { eq, or } from 'drizzle-orm/sql/expressions/conditions';
import { RoomBase, type RoomDto } from 'fpp-server/src/room.types';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { isValidMediumint } from 'fpp/utils/number.utils';
import { generateRoomNumber } from 'fpp/utils/room-number.util';
import { getICreateVoteFromRoomState } from 'fpp/utils/room.util';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { toCustomTRPCError } from 'fpp/server/api/custom-error';
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
        roomId: z.number().positive({ error: 'Room ID must be positive' }),
      }),
    )
    .query(async ({ ctx: { db }, input: { roomId } }) => {
      // Validate room exists
      const room = await db.query.rooms
        .findFirst({
          where: eq(rooms.id, roomId),
        })
        .catch((error) => {
          throw toCustomTRPCError(error, 'Failed to query room', {
            component: 'roomRouter',
            action: 'getRoomStats',
            extra: { roomId },
          });
        });

      if (!room) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Room not found',
        });
      }

      // Fetch room stats from analytics service
      const response = await fetch(
        `${env.ANALYTICS_URL}/room/${roomId}/stats`,
        {
          headers: {
            Authorization: env.ANALYTICS_SECRET_TOKEN,
          },
        },
      ).catch((error) => {
        throw toCustomTRPCError(error, 'Failed to fetch room stats', {
          component: 'roomRouter',
          action: 'getRoomStats',
          extra: {
            roomId,
            endpoint: logEndpoint.GET_ANALYTICS,
            analyticsUrl: `${env.ANALYTICS_URL}/room/${roomId}/stats`,
          },
        });
      });

      if (!response.ok) {
        throw toCustomTRPCError(
          new Error(
            `Analytics API error: ${response.status} ${response.statusText}`,
          ),
          'Analytics API returned error status',
          {
            component: 'roomRouter',
            action: 'getRoomStats',
            extra: {
              roomId,
              endpoint: logEndpoint.GET_ANALYTICS,
              status: response.status,
            },
          },
        );
      }

      return response.json() as Promise<{
        votes: number;
        duration: number;
        estimations: number;
        estimations_per_vote: number;
        avg_min_estimation: number;
        avg_avg_estimation: number;
        avg_max_estimation: number;
        spectators: number;
        spectators_per_vote: number;
      }>;
    }),
  joinRoom: publicProcedure
    .input(
      z.object({
        queryRoom: z
          .string()
          .min(2, { error: 'Room name must be at least 2 characters' })
          .max(15, { error: 'Room name must be at most 15 characters' })
          .transform((val) => val.toLowerCase().trim()),
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
          await db
            .insert(users)
            .values({
              id: userId,
              ...userPayload,
            })
            .catch((error) => {
              throw toCustomTRPCError(error, 'Failed to create user', {
                component: 'roomRouter',
                action: 'joinRoom',
                extra: { userId, queryRoom },
              });
            });
        }

        if (isValidMediumint(queryRoom)) {
          room = await db.query.rooms
            .findFirst({
              where: or(
                eq(rooms.name, queryRoom),
                eq(rooms.number, Number(queryRoom)),
              ),
            })
            .catch((error) => {
              throw toCustomTRPCError(error, 'Failed to query room by number', {
                component: 'roomRouter',
                action: 'joinRoom',
                extra: { queryRoom },
              });
            });
        } else {
          room = await db.query.rooms
            .findFirst({
              where: eq(rooms.name, queryRoom),
            })
            .catch((error) => {
              throw toCustomTRPCError(error, 'Failed to query room by name', {
                component: 'roomRouter',
                action: 'joinRoom',
                extra: { queryRoom },
              });
            });
        }

        if (room) {
          const event: keyof typeof EventType =
            roomEvent === RoomEvent.ENTERED_ROOM_DIRECTLY
              ? EventType.ENTERED_EXISTING_ROOM
              : roomEvent;
          await db
            .insert(events)
            .values({
              userId: userId!,
              event,
            })
            .catch((error) => {
              throw toCustomTRPCError(
                error,
                'Failed to record room entry event',
                {
                  component: 'roomRouter',
                  action: 'joinRoom',
                  extra: { userId, roomId: room!.id, event },
                },
              );
            });
          await db
            .update(rooms)
            .set({
              lastUsedAt: new Date(),
            })
            .where(eq(rooms.id, room.id))
            .catch((error) => {
              throw toCustomTRPCError(
                error,
                'Failed to update room timestamp',
                {
                  component: 'roomRouter',
                  action: 'joinRoom',
                  extra: { roomId: room!.id },
                },
              );
            });
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
          await recursiveInsert().catch((error) => {
            throw toCustomTRPCError(error, 'Failed to create room', {
              component: 'roomRouter',
              action: 'joinRoom',
              extra: { queryRoom, retryCount },
            });
          });
        }

        const event: keyof typeof EventType =
          roomEvent === RoomEvent.ENTERED_ROOM_DIRECTLY
            ? EventType.ENTERED_NEW_ROOM
            : roomEvent;
        await db
          .insert(events)
          .values({
            userId: userId!,
            event,
          })
          .catch((error) => {
            throw toCustomTRPCError(
              error,
              'Failed to record new room entry event',
              {
                component: 'roomRouter',
                action: 'joinRoom',
                extra: { userId, roomId: room!.id, event },
              },
            );
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
        userId: z.string().min(1, { error: 'User ID is required' }),
        roomId: z.number().positive({ error: 'Room ID must be positive' }),
        newRoomName: z
          .string()
          .min(3, { error: 'Room name must be at least 3 characters' })
          .max(15, { error: 'Room name must be at most 15 characters' })
          .transform((val) => val.toLowerCase().trim()),
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
        const existingRoom = await db.query.rooms
          .findFirst({
            where: eq(rooms.id, roomId),
          })
          .catch((error) => {
            throw toCustomTRPCError(error, 'Failed to query room', {
              component: 'roomRouter',
              action: 'updateRoomName',
              extra: { userId, roomId },
            });
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
          conflictingRoom = await db.query.rooms
            .findFirst({
              where: or(
                eq(rooms.name, newRoomName),
                eq(rooms.number, Number(newRoomName)),
              ),
            })
            .catch((error) => {
              throw toCustomTRPCError(
                error,
                'Failed to check for name conflicts',
                {
                  component: 'roomRouter',
                  action: 'updateRoomName',
                  extra: { userId, roomId, newRoomName },
                },
              );
            });
        } else {
          // For non-numeric names, only check name field
          conflictingRoom = await db.query.rooms
            .findFirst({
              where: eq(rooms.name, newRoomName),
            })
            .catch((error) => {
              throw toCustomTRPCError(
                error,
                'Failed to check for name conflicts',
                {
                  component: 'roomRouter',
                  action: 'updateRoomName',
                  extra: { userId, roomId, newRoomName },
                },
              );
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
          .where(eq(rooms.id, roomId))
          .catch((error) => {
            throw toCustomTRPCError(error, 'Failed to update room name', {
              component: 'roomRouter',
              action: 'updateRoomName',
              extra: { userId, roomId, newRoomName },
            });
          });

        // Track the room name change event
        await db
          .insert(events)
          .values({
            userId,
            event: EventType.CHANGED_ROOM_NAME,
          })
          .catch((error) => {
            throw toCustomTRPCError(
              error,
              'Failed to record name change event',
              {
                component: 'roomRouter',
                action: 'updateRoomName',
                extra: { userId, roomId },
              },
            );
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
        roomState: z.string().min(1, { error: 'Room state is required' }),
        roomId: z.number().positive({ error: 'Room ID must be positive' }),
        fppServerSecret: z
          .string()
          .min(1, { error: 'Server secret is required' }),
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

        const roomStateServer = RoomBase.fromJson(roomStateDto);

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

        const results = await Promise.allSettled(promises);
        const failedResults = results.filter(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        );

        if (failedResults.length > 0) {
          throw toCustomTRPCError(
            failedResults[0]!.reason,
            'Failed to persist room state',
            {
              component: 'roomRouter',
              action: 'trackFlip',
              extra: {
                roomId,
                failedCount: failedResults.length,
                totalCount: promises.length,
              },
            },
          );
        }
      },
    ),
});
