import { create } from "zustand";
import {
  type RoomStateClient,
  type roomStateStatus,
  type User,
} from "fpp/server/room-state/room-state.entity";
import { notifyOnRoomStateChanges } from "fpp/server/room-state/room-state.utils";

type RoomStateStore = {
  // User
  userId: string | null;
  setUserId: (clientId: string) => void;
  estimation: number | null;
  isSpectator: boolean;
  // Game State
  users: User[];
  startedAt: number | null;
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
  setUserId: (userId) => set({ userId }),
  estimation: null,
  isSpectator: false,
  // Game State
  users: [],
  startedAt: null,
  isFlipped: false,
  isFlippable: false,
  isAutoFlip: false,
  status: "estimating",
  stackedEstimations: [],
  averageEstimation: null,
  // Initial Connection
  connectedAt: null,
  setConnectedAt: () => set({ connectedAt: Date.now() }),
  // Interactions
  update: (roomState: RoomStateClient) => {
    notifyOnRoomStateChanges({
      newRoomState: {
        users: roomState.users,
        isAutoFlip: roomState.isAutoFlip,
      },
      oldRoomState: {
        users: get().users,
        isAutoFlip: get().isAutoFlip,
      },
      userId: get().userId,
      connectedAt: get().connectedAt,
    });
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
  },
  reset: () => {
    set({
      // User
      estimation: null,
      isSpectator: false,
      // Game State
      users: [],
      startedAt: null,
      isAutoFlip: false,
      status: "estimating",
      // Interactions
      connectedAt: null,
    });
  },
}));
