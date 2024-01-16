import {
  type RoomStateServer,
  type User,
} from "fpp/server/room-state/room-state.entity";
import { env } from "fpp/env.mjs";
import { type ICreateVote } from "fpp/server/db/schema";
import { TRPCError } from "@trpc/server";

export async function publishWebSocketEvent({
  roomState,
  userId,
}: {
  roomState: RoomStateServer;
  userId: string;
}) {
  return fetch(`https://rest.ably.io/channels/room:${roomState.id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${env.ABLY_API_KEY_BASE64}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "room-state",
      clientId: userId,
      data: roomState.toJson(),
    }),
  }).then((res) => {
    if (!res.ok) {
      throw new TRPCError({
        message: `Failed to publish message to Ably`,
        code: "INTERNAL_SERVER_ERROR",
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
    throw new Error("Cannot calculateCreateVote when no estimations");
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
  };
}

export function getAverageFromUsers(users: User[]): number {
  const estimations = getEstimationsFromUsers(users);
  return (
    estimations.reduce((sum, estimation) => sum + estimation, 0) /
    estimations.length
  );
}

export interface IStackedEstimation {
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
