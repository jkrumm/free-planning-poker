import { notifications } from '@mantine/notifications';

import type { Action } from 'fpp-server/src/room.actions';
import { type RoomServer, type User } from 'fpp-server/src/room.entity';

import {
  getFromLocalstorage,
  useLocalstorageStore,
} from 'fpp/store/local-storage.store';
import { useSidebarStore } from 'fpp/store/sidebar.store';

import { type ICreateVote } from 'fpp/server/db/schema';

function getEstimationsFromUsers(
  users: User[],
  triggerAction?: (action: Action) => void,
): number[] {
  const estimations = users
    .map((user) => user.estimation)
    .filter((estimation) => estimation !== null);
  if (
    estimations.length === 0 &&
    triggerAction &&
    typeof window !== 'undefined'
  ) {
    const userId = useLocalstorageStore.getState().userId;
    const roomId = useLocalstorageStore.getState().roomId;

    if (!userId || !roomId) return estimations;

    triggerAction({
      action: 'reset',
      roomId,
      userId,
    });
  }
  return estimations;
}

export function getICreateVoteFromRoomState(
  roomState: RoomServer,
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

export function getAverageFromUsers(
  users: User[],
  triggerAction: (action: Action) => void,
): number {
  const estimations = getEstimationsFromUsers(users, triggerAction);
  return (
    Math.round(
      (estimations.reduce((sum, estimation) => sum + estimation, 0) /
        estimations.length) *
        100,
    ) / 100
  );
}

interface IStackedEstimation {
  number: number;
  amount: number;
}

export function getStackedEstimationsFromUsers(
  users: User[],
  triggerAction: (action: Action) => void,
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
  // Sort by amount and then number descending
  return voting
    .slice(0, getAverageFromUsers(users, triggerAction) > 9 ? 3 : 4)
    .sort((a, b) => {
      if (a.amount === b.amount) {
        return b.number - a.number;
      }
      return b.amount - a.amount;
    });
}

function playSound(sound: 'join' | 'leave' | 'success' | 'tick') {
  if (getFromLocalstorage('isPlaySound') === 'false') return;
  const audio = new Audio(`/sounds/${sound}.wav`);
  audio.volume = sound === 'success' || sound === 'tick' ? 0.4 : 0.3;
  audio
    .play()
    .then(() => ({}))
    .catch(() => ({}));
}

function notify({
  color,
  title,
  message,
}: {
  color: 'red' | 'orange' | 'blue';
  title: string;
  message: string;
}) {
  if (getFromLocalstorage('isNotificationsEnabled') === 'false') return;
  notifications.show({
    color,
    autoClose: 5000,
    withCloseButton: true,
    title,
    message,
  });
}

export function notifyOnRoomChanges({
  newRoom,
  oldRoom,
  userId,
  connectedAt,
}: {
  newRoom: {
    users: User[];
    isAutoFlip: boolean;
    isFlipped: boolean;
  };
  oldRoom: {
    users: User[];
    isAutoFlip: boolean;
    isFlipped: boolean;
  };
  userId: string | null;
  connectedAt: number | null;
}) {
  // Make tick sound if an estimation or isSpectator changed
  for (const newUser of newRoom.users) {
    const oldUser = oldRoom.users.find((user) => user.id === newUser.id);
    if (
      oldUser &&
      (oldUser.estimation !== newUser.estimation ||
        oldUser.isSpectator !== newUser.isSpectator)
    ) {
      playSound('tick');
    }
  }

  // Make success sound and close sidebar if flipped
  if (!oldRoom.isFlipped && newRoom.isFlipped) {
    playSound('success');
    useSidebarStore.setState({ tab: null });
  }

  // Notify on auto flip enabled
  if (newRoom.isAutoFlip && !oldRoom.isAutoFlip) {
    notify({
      color: 'orange',
      title: 'Auto flip enabled',
      message: 'The cards will be flipped automatically once everyone voted',
    });
    return;
  }

  // Early return if user is connected in the last 5 seconds to prevent spam on entry
  const recentlyConnected =
    connectedAt === null || connectedAt > Date.now() - 1000 * 5;
  if (recentlyConnected) {
    return;
  }

  // Notify and join sound once new user joins and who it is
  const newUser = newRoom.users.find(
    (user) => !oldRoom.users.some((oldUser) => oldUser.id === user.id),
  );

  if (newUser && newUser.id !== userId) {
    playSound('join');
    notify({
      color: 'blue',
      title: `${newUser.name} joined`,
      message: 'User joined the room',
    });
    return;
  }

  // Notify and leave sound once user leaves and who it is
  const leftUser = oldRoom.users.find(
    (user) => !newRoom.users.some((newUser) => newUser.id === user.id),
  );
  if (leftUser) {
    playSound('leave');
    notify({
      color: 'red',
      title: `${leftUser.name} left`,
      message: 'User left the room',
    });
    return;
  }
}
