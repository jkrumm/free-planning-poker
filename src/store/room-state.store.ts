import { create } from "zustand";
import {
  type RoomStateClient,
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
  isFlipped: boolean;
  isFlippable: boolean;
  isAutoFlip: boolean;
  stackedEstimations: { number: number; amount: number }[];
  averageEstimation: number | null;
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
  stackedEstimations: [],
  averageEstimation: null,
  // Initial Connection
  isConnecting: true,
  setIsConnecting: (isConnecting) => set({ isConnecting }),
  // Interactions
  update: (roomStateClient: RoomStateClient) => {
    const user = roomStateClient.getUser(get().userId);
    set({
      // User
      estimation: user.estimation,
      isSpectator: user.isSpectator,
      // Game State
      users: roomStateClient.users,
      startedAt: roomStateClient.startedAt,
      isFlipped: roomStateClient.isFlipped,
      isFlippable: roomStateClient.isFlippable,
      isAutoFlip: roomStateClient.isAutoFlip,
    });
    if (roomStateClient.isFlipped) {
      set({
        stackedEstimations: roomStateClient.stackEstimations(),
        averageEstimation: roomStateClient.calculateAverage(),
      });
    }
  },
  reset: () => {
    set({
      // User
      estimation: null,
      isSpectator: false,
      // Game State
      users: [],
      startedAt: null,
      isFlipped: false,
      isAutoFlip: false,
      stackedEstimations: [],
      averageEstimation: null,
      // Interactions
      isConnecting: true,
    });
  },
}));
