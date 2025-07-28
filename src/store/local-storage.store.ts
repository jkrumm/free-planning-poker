import * as Sentry from '@sentry/nextjs';
import { create } from 'zustand';

import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { RoomEvent } from 'fpp/server/db/schema';

function saveToLocalstorage(key: string, value: string) {
  if (typeof window == 'undefined') {
    return;
  }
  localStorage.setItem(key, value);
}

export function getFromLocalstorage(key: string): string | null {
  if (typeof window == 'undefined') {
    return null;
  }
  return localStorage.getItem(key);
}

function getIntFromLocalstorage(key: string): number | null {
  if (
    typeof window == 'undefined' ||
    Number.isInteger(localStorage.getItem(key))
  ) {
    return null;
  }
  return Number(localStorage.getItem(key));
}

interface LocalstorageStore {
  username: string | null;
  isPlaySound: boolean;
  isNotificationsEnabled: boolean;
  isSpectator: boolean;
  preferCardView: boolean;
  roomId: number | null;
  roomName: string | null;
  recentRoom: string | null;
  roomEvent: keyof typeof RoomEvent;
  userId: string | null;
  historicalTableOpen: boolean;
  lastFeedbackSubmission: number | null;
  setUsername: (username: string) => void;
  setIsPlaySound: (isPlaySound: boolean) => void;
  setIsNotificationsEnabled: (isNotificationsEnabled: boolean) => void;
  setIsSpectator: (isSpectator: boolean) => void;
  setPreferCardView: (preferCardView: boolean) => void;
  setRoomId: (roomId: number | null) => void;
  setRoomName: (roomName: string | null) => void;
  setRecentRoom: (recentRoom: string | null) => void;
  setRoomEvent: (roomEvent: keyof typeof RoomEvent) => void;
  setUserId: (userId: string) => void;
  setHistoricalTableOpen: (historicalTableOpen: boolean) => void;
  setLastFeedbackSubmission: (time: number) => void;
  canSubmitFeedback: () => boolean;
}

export const useLocalstorageStore = create<LocalstorageStore>((set, get) => ({
  username: getFromLocalstorage('username'),
  isPlaySound: getFromLocalstorage('isPlaySound')
    ? getFromLocalstorage('isPlaySound') === 'true'
    : true,
  isNotificationsEnabled: getFromLocalstorage('isNotificationsEnabled')
    ? getFromLocalstorage('isNotificationsEnabled') === 'true'
    : true,
  isSpectator: getFromLocalstorage('isSpectator') === 'true',
  preferCardView: getFromLocalstorage('preferCardView') === 'true',
  roomId: getIntFromLocalstorage('roomId'),
  roomName: getFromLocalstorage('roomName'),
  recentRoom: getFromLocalstorage('recentRoom'),
  roomEvent: RoomEvent.ENTERED_ROOM_DIRECTLY,
  userId: (() => {
    const userId = getFromLocalstorage('userId');
    if (!validateNanoId(userId) && typeof window !== 'undefined') {
      localStorage.removeItem('userId');
      set({ userId: null });
      return null;
    }
    if (userId !== null) {
      Sentry.setUser({ id: userId });
    }
    return userId;
  })(),
  historicalTableOpen: getFromLocalstorage('historicalTableOpen') === 'true',
  lastFeedbackSubmission: (() => {
    const time = getFromLocalstorage('lastFeedbackSubmission');
    return time ? parseInt(time, 10) : null;
  })(),
  setUsername: (username: string) => {
    username = username.replace(/[^A-Za-z]/g, '');

    if (username.length < 3) {
      throw new Error('username too short');
    }

    username =
      username.slice(0, 15).charAt(0).toUpperCase() + username.slice(1);

    saveToLocalstorage('username', username);
    set({ username });
  },
  setIsPlaySound: (isPlaySound: boolean) => {
    localStorage.setItem('isPlaySound', isPlaySound.toString());
    set({ isPlaySound });
  },
  setIsNotificationsEnabled: (isNotificationsEnabled: boolean) => {
    localStorage.setItem(
      'isNotificationsEnabled',
      isNotificationsEnabled.toString(),
    );
    set({ isNotificationsEnabled });
  },
  setIsSpectator: (isSpectator: boolean) => {
    localStorage.setItem('isSpectator', isSpectator.toString());
    set({ isSpectator });
  },
  setPreferCardView: (preferCardView: boolean) => {
    localStorage.setItem('preferCardView', preferCardView.toString());
    set({ preferCardView });
  },
  setRoomId: (roomId: number | null) => {
    if (!roomId) {
      localStorage.removeItem('roomId');
      set({ roomId: null });
      return;
    }
    if (get().roomId === roomId) {
      return;
    }

    saveToLocalstorage('roomId', String(roomId));
    set({ roomId });
  },
  setRoomName: (roomName: string | null) => {
    if (!roomName) {
      localStorage.removeItem('roomName');
      set({ roomName: null });
      return;
    }

    roomName = roomName.replace(/[^A-Za-z0-9]/g, '');

    if (roomName.length < 3) {
      throw new Error('room too short');
    }

    roomName = roomName.slice(0, 15).toLowerCase();
    saveToLocalstorage('roomName', roomName);
    set({ roomName });
  },
  setRecentRoom: (recentRoom: string | null) => {
    if (!recentRoom) {
      localStorage.removeItem('recentRoom');
      set({ recentRoom: null });
      return;
    }

    recentRoom = recentRoom.replace(/[^A-Za-z0-9]/g, '');

    if (recentRoom.length < 3) {
      throw new Error('room too short');
    }

    recentRoom = recentRoom.slice(0, 15).toLowerCase();
    saveToLocalstorage('recentRoom', recentRoom);
    set({ recentRoom });
  },
  setRoomEvent: (roomEvent: keyof typeof RoomEvent) => {
    set({ roomEvent });
  },
  setUserId: (userId: string) => {
    if (get().userId === userId || !validateNanoId(userId)) {
      return;
    }
    Sentry.setUser({ id: userId });
    saveToLocalstorage('userId', userId);
    set({ userId });
  },
  setHistoricalTableOpen: (historicalTableOpen: boolean) => {
    localStorage.setItem('historicalTableOpen', historicalTableOpen.toString());
    set({ historicalTableOpen });
  },
  setLastFeedbackSubmission: (time: number) => {
    localStorage.setItem('lastFeedbackSubmission', time.toString());
    set({ lastFeedbackSubmission: time });
  },
  canSubmitFeedback: () => {
    const lastTime = get().lastFeedbackSubmission;
    if (!lastTime) return true;

    const now = Date.now();
    const timeSinceLastSubmission = now - lastTime;
    return timeSinceLastSubmission > 30000; // 30 seconds
  },
}));
