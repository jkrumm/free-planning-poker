import { ReadyState } from 'react-use-websocket';

import {
  type RoomClient,
  type RoomStateStatus,
  type User,
} from 'fpp-server/src/room.entity';
import { create } from 'zustand';

import {
  executeKick,
  notify,
  notifyOnRoomChanges,
  playSound,
} from 'fpp/utils/room.util';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';

type RoomStore = {
  // User
  userId: string | null;
  setUserId: (clientId: string) => void;
  estimation: number | null;
  isSpectator: boolean;
  // Room State
  users: User[];
  startedAt: number;
  isFlipped: boolean;
  isFlippable: boolean;
  isAutoFlip: boolean;
  status: keyof typeof RoomStateStatus;
  // Connection State
  connectedAt: number | null;
  setConnectedAt: () => void;
  lastPongReceived: number;
  setLastPongReceived: (time: number) => void;
  readyState: ReadyState;
  setReadyState: (state: ReadyState) => void;
  // Interactions
  update: (room: RoomClient) => void;
};

export const useRoomStore = create<RoomStore>((set, get) => ({
  // User
  userId: null,
  setUserId: (userId) => validateNanoId(userId) && set({ userId }),
  estimation: null,
  isSpectator: false,
  // Room State
  users: [],
  startedAt: Date.now(),
  isFlipped: false,
  isFlippable: false,
  isAutoFlip: false,
  status: 'estimating',
  stackedEstimations: [],
  averageEstimation: null,
  // Initial Connection
  connectedAt: null,
  setConnectedAt: () => set({ connectedAt: Date.now() }),
  lastPongReceived: Date.now(),
  setLastPongReceived: (time: number) => set({ lastPongReceived: time }),
  readyState: ReadyState.UNINSTANTIATED,
  setReadyState: (state: ReadyState) => set({ readyState: state }),
  // Interactions
  update: (room: RoomClient) => {
    const oldRoom = {
      users: get().users,
      isAutoFlip: get().isAutoFlip,
      isFlipped: get().isFlipped,
    };

    // Check if user is still in the room
    try {
      const userId = get().userId;
      const user = userId ? room.getUser(userId) : null;

      // If a user was previously connected but is no longer in the room, they were kicked
      if (!user && get().connectedAt && oldRoom.users.length > 0 && userId) {
        executeKick('room_update_missing');
        return;
      }

      if (!user) {
        console.error('User not found in room reloading');
        window.location.reload();
        return;
      }

      set({
        // User
        estimation: user.estimation,
        isSpectator: user.isSpectator,
        // Room State
        users: room.users,
        startedAt: room.startedAt,
        isAutoFlip: room.isAutoFlip,
        status: room.status,
      });

      notifyOnRoomChanges({
        newRoom: {
          users: room.users,
          isAutoFlip: room.isAutoFlip,
          isFlipped: room.isFlipped,
        },
        oldRoom,
        userId: user.id,
        connectedAt: get().connectedAt,
      });
    } catch (error) {
      // If an error occurs when getting the user, they were likely kicked
      if (get().connectedAt && oldRoom.users.length > 0) {
        executeKick('error_getting_user');
      }
    }
  },
}));
