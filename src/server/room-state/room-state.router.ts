import { z } from 'zod';

import { fibonacciSequence } from 'fpp/constants/fibonacci.constant';

import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';
import { EventType, type ICreateEvent, events } from 'fpp/server/db/schema';

import {
  getActiveUserIds,
  getRoomStateOrCreate,
  getRoomStateOrFail,
  getRoomStateOrNull,
  setHeartbeat,
  setRoomState,
} from 'fpp/server/room-state/room-state.repository';

export const roomStateRouter = createTRPCRouter({
  enter: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
        userId: z
          .string()
          .refine((userId) => validateNanoId(userId), 'not a valid nanoId'),
        username: z
          .string()
          .min(3)
          .max(15)
          .regex(/^[A-Za-z]+$/),
        isSpectator: z.boolean(),
      }),
    )
    .mutation(
      async ({
        ctx: { db },
        input: { roomId, userId, username, isSpectator },
      }) => {
        const roomState = await getRoomStateOrCreate(roomId);

        roomState.addUser({
          id: userId,
          name: username,
          estimation: null,
          isSpectator,
        });

        await setRoomState({
          roomId,
          userId,
          roomState,
          db,
        });

        return roomState.toJson();
      },
    ),
  get: publicProcedure
    .input(z.object({ roomId: z.number() }))
    .query(async ({ input: { roomId } }) => {
      return await getRoomStateOrFail(roomId);
    }),
  heartbeat: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
        userId: z
          .string()
          .refine((userId) => validateNanoId(userId), 'not a valid nanoId'),
      }),
    )
    .mutation(async ({ ctx: { db }, input: { roomId, userId } }) => {
      const roomState = await getRoomStateOrNull(roomId);

      // If heartbeat executed before roomState is created in Redis just ignore
      if (!roomState) {
        console.warn('Heartbeat for room which is not found in Redis', {
          roomId,
          userId,
        });
        await setHeartbeat(userId, Date.now());
        return;
      }

      // Validate if users are still active
      const userIds = roomState.users.map((user) => user.id);

      const activeUserIds = await getActiveUserIds(userIds);
      if (!activeUserIds.includes(userId)) {
        activeUserIds.push(userId);
      }

      if (activeUserIds.length !== userIds.length) {
        for (const userId of userIds) {
          if (!activeUserIds.includes(userId)) {
            roomState.removeUser(userId);
          }
        }
      }

      await setRoomState({
        roomId,
        userId,
        roomState,
        db,
      });
    }),
  flip: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
        userId: z
          .string()
          .refine((userId) => validateNanoId(userId), 'not a valid nanoId'),
      }),
    )
    .mutation(async ({ ctx: { db }, input: { roomId, userId } }) => {
      const roomState = await getRoomStateOrFail(roomId);

      if (!roomState.isFlippable) {
        console.warn('Room is not in estimating state during flip endpoint', {
          roomId,
          userId,
          status: roomState.status,
        });
        return;
      }

      roomState.flip();

      await setRoomState({
        roomId,
        userId,
        roomState,
        db,
      });
    }),
  estimate: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
        userId: z
          .string()
          .refine((userId) => validateNanoId(userId), 'not a valid nanoId'),
        estimation: z
          .number()
          .refine((estimation) => {
            return (
              fibonacciSequence.includes(estimation) || estimation === null
            );
          }, 'estimation is not a fibonacci number or null')
          .nullable(),
      }),
    )
    .mutation(
      async ({ ctx: { db }, input: { roomId, userId, estimation } }) => {
        const roomState = await getRoomStateOrFail(roomId);

        roomState.setEstimation(userId, estimation);

        await setRoomState({
          roomId,
          userId,
          roomState,
          db,
        });
      },
    ),
  spectator: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
        userId: z
          .string()
          .refine((userId) => validateNanoId(userId), 'not a valid nanoId'),
        isSpectator: z.boolean(),
      }),
    )
    .mutation(
      async ({ ctx: { db }, input: { roomId, userId, isSpectator } }) => {
        const roomState = await getRoomStateOrFail(roomId);

        roomState.setSpectator(userId, isSpectator);

        await setRoomState({
          roomId,
          userId,
          roomState,
          db,
        });
      },
    ),
  autoFlip: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
        userId: z
          .string()
          .refine((userId) => validateNanoId(userId), 'not a valid nanoId'),
        isAutoFlip: z.boolean(),
      }),
    )
    .mutation(
      async ({ ctx: { db }, input: { roomId, userId, isAutoFlip } }) => {
        const roomState = await getRoomStateOrFail(roomId);

        roomState.setAutoFlip(isAutoFlip);

        await setRoomState({
          roomId,
          userId,
          roomState,
          db,
        });
      },
    ),
  reset: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
        userId: z
          .string()
          .refine((userId) => validateNanoId(userId), 'not a valid nanoId'),
      }),
    )
    .mutation(async ({ ctx: { db }, input: { roomId, userId } }) => {
      const roomState = await getRoomStateOrFail(roomId);

      roomState.reset();

      await setRoomState({
        roomId,
        userId,
        roomState,
        db,
      });
    }),
  leave: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
        userId: z
          .string()
          .refine((userId) => validateNanoId(userId), 'not a valid nanoId'),
      }),
    )
    .mutation(async ({ ctx: { db }, input: { roomId, userId } }) => {
      const roomState = await getRoomStateOrFail(roomId);

      roomState.removeUser(userId);

      const event: ICreateEvent = {
        userId,
        event: EventType.LEFT_ROOM,
      };
      await db.insert(events).values(event);

      await setRoomState({
        roomId,
        userId,
        roomState,
        db,
      });
    }),
  changeUsername: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
        userId: z
          .string()
          .refine((userId) => validateNanoId(userId), 'not a valid nanoId'),
        username: z
          .string()
          .min(3)
          .max(15)
          .regex(/^[A-Za-z]+$/),
      }),
    )
    .mutation(async ({ ctx: { db }, input: { roomId, userId, username } }) => {
      const roomState = await getRoomStateOrFail(roomId);

      roomState.changeUsername(userId, username);

      await setRoomState({
        roomId,
        userId,
        roomState,
        db,
      });
    }),
});
