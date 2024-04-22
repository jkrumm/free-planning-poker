import { env } from 'fpp/env';

import { TRPCError } from '@trpc/server';

import { Redis } from '@upstash/redis';
import { eq } from 'drizzle-orm';
import { type MySql2Database } from 'drizzle-orm/mysql2/driver';

import { estimations, rooms, votes } from 'fpp/server/db/schema';

import {
  type RoomStateDto,
  RoomStateServer,
} from 'fpp/server/room-state/room-state.entity';
import {
  getICreateVoteFromRoomState,
  publishWebSocketEvent,
} from 'fpp/server/room-state/room-state.utils';

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL_ROOM_STATE,
  token: env.UPSTASH_REDIS_REST_TOKEN_ROOM_STATE,
});

/**
 * Redis RoomState query methods
 */

export async function getRoomStateOrFail(
  roomId: number,
): Promise<RoomStateServer> {
  const roomState = await redis.get<RoomStateServer>(`room:${roomId}`);

  if (!roomState) {
    throw new TRPCError({
      message: `Room not found in Redis`,
      code: 'NOT_FOUND',
    });
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
  const roomState = await redis.get<RoomStateDto>(`room:${roomId}`);
  if (!roomState) return null;
  return RoomStateServer.fromJson(roomState);
}

/**
 * Update Redis RoomState and the users heartbeat and publish to WebSocket channel
 */

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
  db: MySql2Database<typeof import('../db/schema')>;
}): Promise<void> {
  // NOTE: allow any because prisma and redis have all kind of different promises
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promises: Promise<any>[] = [setHeartbeat(userId, Date.now())];

  if (roomState.isFlipAction) {
    if (!db) {
      throw new TRPCError({
        message: `Cannot flip without a database connection`,
        code: 'INTERNAL_SERVER_ERROR',
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
    promises.push(
      db
        .update(rooms)
        .set({
          lastUsedAt: new Date(),
        })
        .where(eq(rooms.id, roomId)),
    );
    roomState.isFlipAction = false;
  }

  // If the room state has changed or if the room state hasn't changed in the last 4 minutes
  // we update the room state in Redis and publish to the WebSocket channel
  if (
    roomState.hasChanged ||
    roomState.lastUpdated < Date.now() - 1000 * 60 * 4
  ) {
    roomState.lastUpdated = Date.now();
    promises.push(
      redis.set(`room:${roomId}`, roomState, { ex: 60 * 5 }),
      publishWebSocketEvent({ roomState, userId }),
    );
  }

  await Promise.allSettled(promises).then((results) => {
    for (const result of results) {
      if (result.status === 'rejected' && result.reason instanceof TRPCError) {
        console.error('Failed to fully set room state', {
          roomId,
          userId,
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
}

/**
 * Redis heartbeat methods
 */

export async function getActiveUserIds(userIds: string[]): Promise<string[]> {
  const activeUserIds = [];
  for (const userId of userIds) {
    const heartbeat = await redis.get(`heartbeat:${userId}`);
    if (heartbeat != null) {
      activeUserIds.push(userId);
    }
  }
  return activeUserIds;
}

export async function setHeartbeat(
  userId: string,
  heartbeat: number,
): Promise<void> {
  await redis.set(`heartbeat:${userId}`, heartbeat, {
    ex: 15,
  });
}
