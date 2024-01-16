import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { z } from "zod";
import {
  getActiveUserIds,
  getRoomStateOrCreate,
  getRoomStateOrFail,
  setRoomState,
} from "fpp/server/room-state/room-state.repository";

export const roomStateRouter = createTRPCRouter({
  enter: publicProcedure
    .input(
      z.object({
        roomId: z.number(),
        userId: z
          .string()
          .regex(/^[A-Za-z0-9_~]{21}$/, "userId regex mismatch"),
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
    .query(async ({ ctx, input: { roomId } }) => {
      return await getRoomStateOrFail(roomId);
    }),
  heartbeat: publicProcedure
    .input(z.object({ roomId: z.number(), userId: z.string() }))
    .mutation(async ({ ctx: { db }, input: { roomId, userId } }) => {
      const roomState = await getRoomStateOrFail(roomId);
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
    .input(z.object({ roomId: z.number(), userId: z.string() }))
    .mutation(async ({ ctx: { db }, input: { roomId, userId } }) => {
      const roomState = await getRoomStateOrFail(roomId);

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
        userId: z.string(),
        estimation: z.number().nullable(),
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
        userId: z.string(),
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
        userId: z.string(),
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
    .input(z.object({ roomId: z.number(), userId: z.string() }))
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
    .input(z.object({ roomId: z.number(), userId: z.string() }))
    .mutation(async ({ ctx: { db }, input: { roomId, userId } }) => {
      const roomState = await getRoomStateOrFail(roomId);

      roomState.removeUser(userId);

      await setRoomState({
        roomId,
        userId,
        roomState,
        db,
      });
    }),
});
