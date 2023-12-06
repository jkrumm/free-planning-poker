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

interface LocalstorageStore {
  username: string | null;
  voting: number | null;
  spectator: boolean;
  room: string | null;
  recentRoom: string | null;
  visitorId: string | null;
  setUsername: (username: string) => void;
  setVoting: (voting: number | null) => void;
  setSpectator: (spectator: boolean) => void;
  setRoom: (room: string | null) => void;
  setRecentRoom: (room: string | null) => void;
  setVisitorId: (visitorId: string) => void;
}

export const useLocalstorageStore = create<LocalstorageStore>((set, get) => ({
  username: getFromLocalstorage("username"),
  voting: getFromLocalstorage("vote")
    ? Number(getFromLocalstorage("vote"))
    : null,
  spectator: getFromLocalstorage("spectator") === "true",
  room: getFromLocalstorage("room"),
  recentRoom: getFromLocalstorage("recentRoom"),
  visitorId: (() => {
    const visitorId = getFromLocalstorage("visitorId");
    if (visitorId !== null) {
      Sentry.setUser({ id: visitorId });
    }
    return visitorId;
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
  setRoom: (room: string | null) => {
    if (!room) {
      localStorage.removeItem("room");
      set({ room: null });
      return;
    }
    if (get().room === room) {
      return;
    }

    room = room.replace(/[^A-Za-z0-9]/g, "");

    if (room.length < 3) {
      throw new Error("room too short");
    }

    room = room.slice(0, 15).toLowerCase();
    saveToLocalstorage("room", room);
    set({ room });
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
  setVisitorId: (visitorId: string) => {
    if (get().visitorId === visitorId) {
      return;
    }
    Sentry.setUser({ id: visitorId });
    saveToLocalstorage("visitorId", visitorId);
    set({ visitorId });
  },
}));
