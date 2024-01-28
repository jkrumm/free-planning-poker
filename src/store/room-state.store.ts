import { create } from 'zustand';

import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import {
  type RoomStateClient,
  type User,
  type roomStateStatus,
} from 'fpp/server/room-state/room-state.entity';
import { notifyOnRoomStateChanges } from 'fpp/server/room-state/room-state.utils';

type RoomStateStore = {
  // User
  userId: string | null;
  setUserId: (clientId: string) => void;
  estimation: number | null;
  isSpectator: boolean;
  // Game State
  users: User[];
  startedAt: number;
  isFlipped: boolean;
  isFlippable: boolean;
  isAutoFlip: boolean;
  status: keyof typeof roomStateStatus;
  // Interactions
  connectedAt: number | null;
  setConnectedAt: () => void;
  update: (roomState: RoomStateClient) => void;
  reset: () => void;
};

export const useRoomStateStore = create<RoomStateStore>((set, get) => ({
  // User
  userId: null,
  setUserId: (userId) => validateNanoId(userId) && set({ userId }),
  estimation: null,
  isSpectator: false,
  // Game State
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
  update: (roomState: RoomStateClient) => {
    const oldRoomState = {
      users: get().users,
      isAutoFlip: get().isAutoFlip,
      isFlipped: get().isFlipped,
    };
    const user = roomState.getUser(get().userId);
    set({
      // User
      estimation: user.estimation,
      isSpectator: user.isSpectator,
      // Game State
      users: roomState.users,
      startedAt: roomState.startedAt,
      isAutoFlip: roomState.isAutoFlip,
      status: roomState.status,
    });
    notifyOnRoomStateChanges({
      newRoomState: {
        users: roomState.users,
        isAutoFlip: roomState.isAutoFlip,
        isFlipped: roomState.isFlipped,
      },
      oldRoomState,
      userId: user.id,
      connectedAt: get().connectedAt,
    });
  },
  reset: () => {
    set({
      // User
      estimation: null,
      isSpectator: false,
      // Game State
      users: [],
      startedAt: Date.now(),
      isAutoFlip: false,
      status: 'estimating',
      // Interactions
      connectedAt: null,
    });
  },
}));
