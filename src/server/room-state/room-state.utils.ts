import { env } from 'fpp/env.mjs';

import { TRPCError } from '@trpc/server';

import { notifications } from '@mantine/notifications';

import { type ICreateVote } from 'fpp/server/db/schema';

import {
  type RoomStateServer,
  type User,
} from 'fpp/server/room-state/room-state.entity';

export async function publishWebSocketEvent({
  roomState,
  userId,
}: {
  roomState: RoomStateServer;
  userId: string;
}) {
  return fetch(`https://rest.ably.io/channels/room:${roomState.id}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${env.ABLY_API_KEY_BASE64}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'room-state',
      clientId: userId,
      data: roomState.toJson(),
    }),
  }).then((res) => {
    if (!res.ok) {
      throw new TRPCError({
        message: `Failed to publish message to Ably`,
        code: 'INTERNAL_SERVER_ERROR',
        cause: res.text().then((text) => {
          return new Error(text);
        }),
      });
    }
  });
}

function getEstimationsFromUsers(users: User[]): number[] {
  const estimations = users
    .map((user) => user.estimation)
    .filter((estimation) => estimation !== null) as number[];
  if (estimations.length === 0) {
    throw new Error('Cannot calculateCreateVote when no estimations');
  }
  return estimations;
}

export function getICreateVoteFromRoomState(
  roomState: RoomStateServer,
): ICreateVote {
  const estimations = getEstimationsFromUsers(roomState.users);
  return {
    roomId: roomState.id,
    avgEstimation: String(
      estimations.reduce((a, b) => a + b, 0) / estimations.length,
    ),
    maxEstimation: String(
      estimations.reduce((a, b) => Math.max(a, b), 1),
    ) as unknown as number,
    minEstimation: String(
      estimations.reduce((a, b) => Math.min(a, b), 21),
    ) as unknown as number,
    amountOfEstimations: String(estimations.length) as unknown as number,
    amountOfSpectators: roomState.users.filter((user) => user.isSpectator)
      .length,
    duration: Math.ceil((Date.now() - roomState.startedAt) / 1000),
    wasAutoFlip: roomState.isAutoFlip,
  };
}

export function getAverageFromUsers(users: User[]): number {
  const estimations = getEstimationsFromUsers(users);
  return (
    estimations.reduce((sum, estimation) => sum + estimation, 0) /
    estimations.length
  );
}

interface IStackedEstimation {
  number: number;
  amount: number;
}

export function getStackedEstimationsFromUsers(
  users: User[],
): IStackedEstimation[] {
  const voting: { number: number; amount: number }[] = [];
  users.forEach((item) => {
    if (!item.estimation) return;
    const index = voting.findIndex((v) => v.number === item.estimation);
    if (index === -1) {
      voting.push({ number: item.estimation, amount: 1 });
    } else {
      voting[index]!.amount++;
    }
  });
  return voting.slice(0, getAverageFromUsers(users) > 9 ? 3 : 4);
}

export function notifyOnRoomStateChanges({
  newRoomState,
  oldRoomState,
  userId,
  connectedAt,
}: {
  newRoomState: {
    users: User[];
    isAutoFlip: boolean;
  };
  oldRoomState: {
    users: User[];
    isAutoFlip: boolean;
  };
  userId: string | null;
  connectedAt: number | null;
}) {
  // Notify on auto flip enabled
  if (newRoomState.isAutoFlip && !oldRoomState.isAutoFlip) {
    notifications.show({
      color: 'orange',
      autoClose: 5000,
      withCloseButton: true,
      title: 'Auto Flip enabled',
      message: 'Voting will flip automatically once everyone estimated',
    });
    return;
  }
  const recentlyConnected =
    connectedAt === null || connectedAt > Date.now() - 1000 * 5;
  if (recentlyConnected) {
    return;
  }

  // Notify once new user joins and who it is
  const newUser = newRoomState.users.find(
    (user) => !oldRoomState.users.some((oldUser) => oldUser.id === user.id),
  );

  if (newUser && newUser.id !== userId) {
    notifications.show({
      color: 'blue',
      autoClose: 5000,
      withCloseButton: true,
      title: `${newUser.name} joined`,
      message: 'User joined the room',
    });
    return;
  }

  // Notify once user leaves and who it is
  const leftUser = oldRoomState.users.find(
    (user) => !newRoomState.users.some((newUser) => newUser.id === user.id),
  );
  if (leftUser) {
    notifications.show({
      color: 'red',
      autoClose: 5000,
      withCloseButton: true,
      title: `${leftUser.name} left`,
      message: 'User left the room',
    });
    return;
  }
}
