import { create } from "zustand";
import {
  type RoomStateClient,
  type roomStateStatus,
  type User,
} from "fpp/server/room-state/room-state.entity";

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
  isConnecting: boolean;
  setIsConnecting: (isConnecting: boolean) => void;
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
  isConnecting: true,
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  // Interactions
  update: (roomState: RoomStateClient) => {
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
      isConnecting: true,
    });
  },
}));
