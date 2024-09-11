import {
  type RoomClient,
  type RoomStateStatus,
  type User,
} from 'fpp-server/src/room.entity';
import { create } from 'zustand';

import { notifyOnRoomChanges } from 'fpp/utils/room.util';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

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
  // Interactions
  connectedAt: number | null;
  setConnectedAt: () => void;
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
  // Interactions
  update: (room: RoomClient) => {
    const oldRoom = {
      users: get().users,
      isAutoFlip: get().isAutoFlip,
      isFlipped: get().isFlipped,
    };
    const user = room.getUser(get().userId);
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
  },
}));
