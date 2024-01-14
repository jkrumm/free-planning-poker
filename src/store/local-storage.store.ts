import { create } from "zustand";
import * as Sentry from "@sentry/nextjs";

function saveToLocalstorage(key: string, value: string) {
  if (typeof window == "undefined") {
    return;
  }
  localStorage.setItem(key, value);
}

function getFromLocalstorage(key: string): string | null {
  if (typeof window == "undefined") {
    return null;
  }
  return localStorage.getItem(key);
}

function getIntFromLocalstorage(key: string): number | null {
  if (
    typeof window == "undefined" ||
    Number.isInteger(localStorage.getItem(key))
  ) {
    return null;
  }
  return Number(localStorage.getItem(key));
}

interface LocalstorageStore {
  username: string | null;
  voting: number | null;
  spectator: boolean;
  roomId: number | null;
  roomReadable: string | null;
  recentRoom: string | null;
  userId: string | null;
  setUsername: (username: string) => void;
  setVoting: (voting: number | null) => void;
  setSpectator: (spectator: boolean) => void;
  setRoomId: (room: number | null) => void;
  setRoomReadable: (room: string | null) => void;
  setRecentRoom: (room: string | null) => void;
  setUserId: (userId: string) => void;
}

export const useLocalstorageStore = create<LocalstorageStore>((set, get) => ({
  username: getFromLocalstorage("username"),
  voting: getFromLocalstorage("vote")
    ? Number(getFromLocalstorage("vote"))
    : null,
  spectator: getFromLocalstorage("spectator") === "true",
  roomId: getIntFromLocalstorage("roomId"),
  roomReadable: getFromLocalstorage("roomReadableId"),
  recentRoom: getFromLocalstorage("recentRoom"),
  userId: (() => {
    const userId = getFromLocalstorage("userId");
    // TODO: remove this after a while (2023-12-08)
    if (userId?.length !== 21 && typeof window !== "undefined") {
      localStorage.removeItem("vote");
      return null;
    }
    if (userId !== null) {
      Sentry.setUser({ id: userId });
    }
    return userId;
  })(),
  setUsername: (username: string) => {
    username = username.replace(/[^A-Za-z]/g, "");

    if (username.length < 3) {
      throw new Error("username too short");
    }

    username =
      username.slice(0, 15).charAt(0).toUpperCase() + username.slice(1);

    saveToLocalstorage("username", username);
    set({ username });
  },
  setVoting: (voting: number | null) => {
    if (voting === null) {
      localStorage.removeItem("vote");
    } else {
      localStorage.setItem("vote", voting.toString());
    }
    set({ voting });
  },
  setSpectator: (spectator: boolean) => {
    localStorage.setItem("spectator", spectator.toString());
    set({ spectator });
  },
  setRoomId: (roomId: number | null) => {
    if (!roomId) {
      localStorage.removeItem("roomId");
      set({ roomId: null });
      return;
    }
    if (get().roomId === roomId) {
      return;
    }

    saveToLocalstorage("roomId", String(roomId));
    set({ roomId });
  },
  setRoomReadable: (roomReadable: string | null) => {
    if (!roomReadable) {
      localStorage.removeItem("roomReadable");
      set({ roomReadable: null });
      return;
    }

    roomReadable = roomReadable.replace(/[^A-Za-z0-9]/g, "");

    if (roomReadable.length < 3) {
      throw new Error("room too short");
    }

    roomReadable = roomReadable.slice(0, 15).toLowerCase();
    saveToLocalstorage("roomReadable", roomReadable);
    set({ roomReadable });
  },
  setRecentRoom: (recentRoom: string | null) => {
    if (!recentRoom) {
      localStorage.removeItem("recentRoom");
      set({ recentRoom: null });
      return;
    }

    recentRoom = recentRoom.replace(/[^A-Za-z0-9]/g, "");

    if (recentRoom.length < 3) {
      throw new Error("room too short");
    }

    recentRoom = recentRoom.slice(0, 15).toLowerCase();
    saveToLocalstorage("recentRoom", recentRoom);
    set({ recentRoom });
  },
  setUserId: (userId: string) => {
    if (get().userId === userId) {
      return;
    }
    Sentry.setUser({ id: userId });
    saveToLocalstorage("userId", userId);
    set({ userId });
  },
}));
