import { env } from "fpp/env.mjs";
import { RoomStateServer } from "fpp/server/room-state/room-state.entity";
import { Redis } from "@upstash/redis";
import { type PlanetScaleDatabase } from "drizzle-orm/planetscale-serverless/driver";
import { estimations, votes } from "fpp/server/db/schema";
import {
  getICreateVoteFromRoomState,
  publishWebSocketEvent,
} from "fpp/server/room-state/room-state.utils";
import { TRPCError } from "@trpc/server";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL_ROOM_STATE,
  token: env.UPSTASH_REDIS_REST_TOKEN_ROOM_STATE,
});

export async function getRoomStateOrFail(
  roomId: number,
): Promise<RoomStateServer> {
  const roomState = await redis.get<RoomStateServer>(`room:${roomId}`);

  if (!roomState) {
    throw new TRPCError({ message: `Room not found`, code: "NOT_FOUND" });
  }

  return RoomStateServer.fromJson(roomState);
}

export async function getRoomStateOrCreate(
  roomId: number,
): Promise<RoomStateServer> {
  const roomState = await redis.get<RoomStateServer>(`room:${roomId}`);

  if (!roomState) {
    return new RoomStateServer(roomId);
  }

  return RoomStateServer.fromJson(roomState);
}

export async function getRoomStateOrNull(
  roomId: number,
): Promise<RoomStateServer | null> {
  return (await redis.get<RoomStateServer>(`room:${roomId}`)) ?? null;
}

export async function setRoomState({
  roomId,
  userId,
  roomState,
  db,
}: {
  roomId: number;
  userId: string;
  roomState: RoomStateServer;
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  db: PlanetScaleDatabase<typeof import("../db/schema")>;
}): Promise<void> {
  // NOTE: allow any because prisma and redis have all kind of different promises
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promises: Promise<any>[] = [setHeartbeat(userId, Date.now())];

  if (roomState.isFlipAction) {
    if (!db) {
      throw new TRPCError({
        message: `Cannot flip without a database connection`,
        code: "INTERNAL_SERVER_ERROR",
      });
    }
    promises.push(
      db.insert(votes).values(getICreateVoteFromRoomState(roomState)),
    );
    for (const user of roomState.users) {
      promises.push(
        db.insert(estimations).values({
          userId: user.id,
          roomId,
          estimation: user.estimation,
          spectator: user.isSpectator,
        }),
      );
    }
    roomState.isFlipAction = false;
  }

  // If the room state has changed, we update Redis and publish to it's WebSocket channel
  if (roomState.hasChanged) {
    roomState.lastUpdated = Date.now();
    promises.push(
      redis.set(`room:${roomId}`, roomState, { ex: 60 * 5 }),
      publishWebSocketEvent({ roomState, userId }),
    );
  }

  // If the room state hasn't changed in the last 5 minutes minus 20 seconds, we extend the expiration time
  // TODO: close the room after 5 minutes of inactivity
  if (
    !roomState.hasChanged &&
    roomState.lastUpdated > Date.now() - 1000 * 60 * 5 - 1000 * 20
  ) {
    promises.push(redis.expire(`room:${roomId}`, 60 * 5));
  }

  await Promise.allSettled(promises);
}

export async function getActiveUserIds(userIds: string[]): Promise<string[]> {
  const heartbeats = await redis.mget<(number | null)[]>(
    userIds.map((userId) => `heartbeat:${userId}`),
  );
  return userIds.map((userId, i) => {
    if (heartbeats[i] != null) {
      return userId;
    }
  }) as string[];
}

export async function setHeartbeat(
  userId: string,
  heartbeat: number,
): Promise<void> {
  await redis.set(`heartbeat:${userId}`, heartbeat, {
    ex: 15,
  });
}
