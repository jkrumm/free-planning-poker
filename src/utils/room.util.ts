import { type NextRouter } from 'next/router';

import { notifications } from '@mantine/notifications';

import confetti from 'canvas-confetti';
import type { Action } from 'fpp-server/src/room.actions';
import { type RoomBase } from 'fpp-server/src/room.types';
import { type User } from 'fpp-server/src/room.types';

import {
  addBreadcrumb,
  captureError,
  captureMessage,
} from 'fpp/utils/app-error';

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
  try {
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

      if (!userId || !roomId) {
        captureError(
          'Missing user or room ID for auto-reset',
          {
            component: 'getEstimationsFromUsers',
            action: 'autoReset',
            extra: {
              hasUserId: !!userId,
              hasRoomId: !!roomId,
              userCount: users.length,
            },
          },
          'low',
        );
        return estimations;
      }

      addBreadcrumb('Auto-resetting room due to no estimations', 'room', {
        roomId,
        userCount: users.length,
      });

      triggerAction({
        action: 'reset',
        roomId,
        userId,
      });
    }
    return estimations;
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to get estimations from users'),
      {
        component: 'getEstimationsFromUsers',
        action: 'processEstimations',
        extra: {
          userCount: users.length,
          hasTriggerAction: !!triggerAction,
        },
      },
      'medium',
    );
    return [];
  }
}

export function getICreateVoteFromRoomState(roomState: RoomBase): ICreateVote {
  try {
    const estimations = getEstimationsFromUsers(roomState.users);

    if (estimations.length === 0) {
      captureError(
        'No estimations available for vote creation',
        {
          component: 'getICreateVoteFromRoomState',
          action: 'validateEstimations',
          extra: {
            roomId: roomState.id,
            userCount: roomState.users.length,
          },
        },
        'medium',
      );
    }

    const result: ICreateVote = {
      roomId: roomState.id,
      avgEstimation: String(
        estimations.length > 0
          ? estimations.reduce((a, b) => a + b, 0) / estimations.length
          : 0,
      ),
      maxEstimation: String(
        estimations.length > 0
          ? estimations.reduce((a, b) => Math.max(a, b), 1)
          : 1,
      ) as unknown as number,
      minEstimation: String(
        estimations.length > 0
          ? estimations.reduce((a, b) => Math.min(a, b), 21)
          : 21,
      ) as unknown as number,
      amountOfEstimations: String(estimations.length) as unknown as number,
      amountOfSpectators: roomState.users.filter((user) => user.isSpectator)
        .length,
      duration: Math.ceil((Date.now() - roomState.startedAt) / 1000),
      wasAutoFlip: roomState.isAutoFlip,
    };

    addBreadcrumb('Vote data created from room state', 'room', {
      roomId: roomState.id,
      estimationCount: estimations.length,
      spectatorCount: result.amountOfSpectators,
      duration: result.duration,
    });

    return result;
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to create vote from room state'),
      {
        component: 'getICreateVoteFromRoomState',
        action: 'createVote',
        extra: {
          roomId: roomState.id,
          userCount: roomState.users.length,
        },
      },
      'high',
    );

    // Return fallback data
    return {
      roomId: roomState.id,
      avgEstimation: '0',
      maxEstimation: 1 as unknown as number,
      minEstimation: 21 as unknown as number,
      amountOfEstimations: 0 as unknown as number,
      amountOfSpectators: 0,
      duration: 0,
      wasAutoFlip: false,
    };
  }
}

export function getAverageFromUsers(
  users: User[],
  triggerAction: (action: Action) => void,
): string {
  try {
    const estimations = getEstimationsFromUsers(users, triggerAction);
    if (estimations.length === 0) {
      return '0';
    }
    const average =
      estimations.reduce((sum, estimation) => sum + estimation, 0) /
      estimations.length;
    return String(Math.round(average * 10) / 10);
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to calculate average from users'),
      {
        component: 'getAverageFromUsers',
        action: 'calculateAverage',
        extra: {
          userCount: users.length,
        },
      },
      'medium',
    );
    return '0';
  }
}

interface IStackedEstimation {
  number: number;
  amount: number;
}

export function getStackedEstimationsFromUsers(
  users: User[],
  triggerAction: (action: Action) => void,
): IStackedEstimation[] {
  try {
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

    const averageStr = getAverageFromUsers(users, triggerAction);
    const average = parseInt(averageStr);
    const maxResults = average > 9 ? 3 : 4;

    // Sort by amount and then number descending
    const result = voting.slice(0, maxResults).sort((a, b) => {
      if (a.amount === b.amount) {
        return b.number - a.number;
      }
      return b.amount - a.amount;
    });

    addBreadcrumb('Stacked estimations calculated', 'room', {
      userCount: users.length,
      votingOptions: result.length,
      average: averageStr,
    });

    return result;
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to get stacked estimations from users'),
      {
        component: 'getStackedEstimationsFromUsers',
        action: 'calculateStacked',
        extra: {
          userCount: users.length,
        },
      },
      'medium',
    );
    return [];
  }
}

// Add a flag to track if user has interacted
let hasUserInteracted = false;
let audioContext: AudioContext | null = null;
const audioBuffers = new Map<string, AudioBuffer>();

// Initialize audio context after user interaction
async function initializeWebAudio() {
  if (typeof window === 'undefined' || audioContext) return;

  try {
    audioContext = new (
      window.AudioContext ||
      // eslint-disable-next-line
      (window as any).webkitAudioContext
    )();

    // Resume audio context if it's suspended (required by some browsers)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    addBreadcrumb('Web Audio context initialized', 'audio', {
      state: audioContext.state,
    });

    // Pre-load audio files
    await preloadAudioFiles();
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to initialize Web Audio'),
      {
        component: 'initializeWebAudio',
        action: 'initialize',
      },
      'medium',
    );
    // Fallback to HTML5 audio
    audioContext = null;
  }
}

async function preloadAudioFiles() {
  if (!audioContext) return;

  const sounds = ['join', 'leave', 'success', 'tick'];

  try {
    for (const sound of sounds) {
      const response = await fetch(`/sounds/${sound}.wav`);
      if (!response.ok) {
        addBreadcrumb('Failed to fetch audio file', 'audio', { sound });
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      audioBuffers.set(sound, audioBuffer);
    }

    addBreadcrumb('Audio files preloaded', 'audio', {
      loadedCount: audioBuffers.size,
    });
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to preload audio files'),
      {
        component: 'preloadAudioFiles',
        action: 'preload',
      },
      'medium',
    );
  }
}

// Track user interaction and initialize audio
export function initializeAudioContext() {
  if (typeof window === 'undefined') return;

  const events = ['click', 'keydown', 'touchstart', 'touchend'];

  const enableAudio = () => {
    if (hasUserInteracted) return;

    hasUserInteracted = true;
    addBreadcrumb('User interaction detected for audio', 'audio');

    // Initialize Web Audio API without awaiting in event handler
    initializeWebAudio().catch((error) => {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to initialize audio after user interaction'),
        {
          component: 'initializeAudioContext',
          action: 'enableAudio',
        },
        'medium',
      );
    });

    // Remove event listeners
    events.forEach((event) => {
      document.removeEventListener(event, enableAudio);
    });
  };

  events.forEach((event) => {
    document.addEventListener(event, enableAudio, { passive: true });
  });
}

function playWebAudioSound(sound: 'join' | 'leave' | 'success' | 'tick') {
  if (audioContext?.state !== 'running' || !hasUserInteracted) {
    addBreadcrumb('Web Audio not available', 'audio', {
      hasContext: !!audioContext,
      contextState: audioContext?.state ?? 'null',
      hasInteraction: hasUserInteracted,
    });
    return false;
  }

  const buffer = audioBuffers.get(sound);
  if (!buffer) {
    addBreadcrumb('Audio buffer not found', 'audio', { sound });
    return false;
  }

  try {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();

    source.buffer = buffer;
    gainNode.gain.value = sound === 'success' || sound === 'tick' ? 0.3 : 0.2;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);

    source.start();
    addBreadcrumb('Web Audio sound played', 'audio', { sound });
    return true;
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to play Web Audio sound'),
      {
        component: 'playWebAudioSound',
        action: 'play',
        extra: { sound },
      },
      'low',
    );
    return false;
  }
}

// Fallback to HTML5 Audio
function playHtml5Sound(sound: 'join' | 'leave' | 'success' | 'tick') {
  if (!hasUserInteracted) {
    addBreadcrumb('HTML5 Audio blocked - no user interaction', 'audio', {
      sound,
    });
    return;
  }

  try {
    const audio = new Audio(`/sounds/${sound}.wav`);
    audio.volume = sound === 'success' || sound === 'tick' ? 0.3 : 0.2;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          addBreadcrumb('HTML5 Audio sound played', 'audio', { sound });
        })
        .catch((error) => {
          if (error instanceof Error && error.name === 'NotAllowedError') {
            addBreadcrumb('HTML5 Audio blocked by autoplay policy', 'audio', {
              sound,
            });
          } else {
            captureError(
              error instanceof Error
                ? error
                : new Error('Failed to play HTML5 sound'),
              {
                component: 'playHtml5Sound',
                action: 'play',
                extra: {
                  sound,
                  errorName: error instanceof Error ? error.name : 'Unknown',
                },
              },
              'low',
            );
          }
        });
    }
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to create HTML5 audio'),
      {
        component: 'playHtml5Sound',
        action: 'create',
        extra: { sound },
      },
      'low',
    );
  }
}

function playSound(sound: 'join' | 'leave' | 'success' | 'tick') {
  try {
    if (getFromLocalstorage('isPlaySound') === 'false') return;

    if (!hasUserInteracted) {
      addBreadcrumb('Audio blocked - no user interaction', 'audio', { sound });
      return;
    }

    // Try Web Audio first, fallback to HTML5 Audio
    const webAudioSuccess = playWebAudioSound(sound);
    if (!webAudioSuccess) {
      playHtml5Sound(sound);
    }
  } catch (error) {
    captureError(
      error instanceof Error ? error : new Error('Failed to play sound'),
      {
        component: 'playSound',
        action: 'play',
        extra: { sound },
      },
      'low',
    );
  }
}

function notify({
  color,
  title,
  message,
  autoClose,
}: {
  color: 'red' | 'orange' | 'blue';
  title: string;
  message: string;
  autoClose?: number | boolean;
}) {
  try {
    if (getFromLocalstorage('isNotificationsEnabled') === 'false') return;
    notifications.show({
      color,
      autoClose: autoClose ?? 5000,
      withCloseButton: true,
      title,
      message,
    });
    addBreadcrumb('Notification shown', 'notification', {
      color,
      title,
      autoClose: autoClose ?? 5000,
    });
  } catch (error) {
    captureError(
      error instanceof Error ? error : new Error('Failed to show notification'),
      {
        component: 'notify',
        action: 'show',
        extra: { color, title, message },
      },
      'low',
    );
  }
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
  try {
    // Make tick sound if an estimation or isSpectator changed
    for (const newUser of newRoom.users) {
      const oldUser = oldRoom.users.find((user) => user.id === newUser.id);
      if (
        oldUser &&
        (oldUser.estimation !== newUser.estimation ||
          oldUser.isSpectator !== newUser.isSpectator)
      ) {
        playSound('tick');
        addBreadcrumb('User state changed', 'room', {
          userId: newUser.id,
          estimationChanged: oldUser.estimation !== newUser.estimation,
          spectatorChanged: oldUser.isSpectator !== newUser.isSpectator,
        });
      }
    }

    // Make success sound and close sidebar if flipped and pop confetti if everyone estimated the same
    if (!oldRoom.isFlipped && newRoom.isFlipped) {
      playSound('success');
      useSidebarStore.setState({ tab: null });

      const estimations = getEstimationsFromUsers(newRoom.users);
      const isUnanimous =
        estimations.length > 1 && new Set(estimations).size === 1;

      addBreadcrumb('Room flipped', 'room', {
        estimationCount: estimations.length,
        isUnanimous,
      });

      if (isUnanimous) {
        confetti({
          particleCount: 200,
          spread: 80,
          origin: { y: 0.4 },
        })
          ?.then(() => {
            addBreadcrumb('Confetti celebration triggered', 'room');
          })
          .catch((error) => {
            captureError(
              error instanceof Error
                ? error
                : new Error('Failed to trigger confetti'),
              {
                component: 'notifyOnRoomChanges',
                action: 'confetti',
              },
              'low',
            );
          });
      }
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
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to process room changes'),
      {
        component: 'notifyOnRoomChanges',
        action: 'processChanges',
        extra: {
          newUserCount: newRoom.users.length,
          oldUserCount: oldRoom.users.length,
          isFlipped: newRoom.isFlipped,
          wasFlipped: oldRoom.isFlipped,
        },
      },
      'medium',
    );
  }
}

export function executeLeave({
  roomId,
  userId,
  triggerAction,
  router,
}: {
  roomId: number;
  userId: string;
  triggerAction: (action: Action) => void;
  router?: NextRouter;
}) {
  try {
    addBreadcrumb('Executing room leave', 'room', {
      roomId,
      userId,
      hasRouter: !!router,
    });

    // Cleanup room State
    const { setRoomId, setRoomName } = useLocalstorageStore.getState();
    setRoomId(null);
    setRoomName(null);

    // Send leave action to server
    triggerAction({
      action: 'leave',
      roomId,
      userId,
    });

    // Navigate to homepage
    if (router) {
      router
        .push('/')
        .then(() => {
          addBreadcrumb('Navigation to homepage successful', 'navigation');
        })
        .catch((error) => {
          captureError(
            error instanceof Error
              ? error
              : new Error('Failed to navigate to homepage after leave'),
            {
              component: 'executeLeave',
              action: 'navigate',
              extra: { roomId, userId },
            },
            'medium',
          );
        });
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to execute room leave'),
      {
        component: 'executeLeave',
        action: 'leave',
        extra: { roomId, userId },
      },
      'high',
    );
  }
}

export function executeKick(
  scenario: 'kick_notification' | 'room_update_missing' | 'error_getting_user',
  router?: NextRouter,
): void {
  try {
    addBreadcrumb('Executing kick', 'room', {
      scenario,
      hasRouter: !!router,
    });
    if (scenario !== 'kick_notification') {
      captureMessage(
        `User was kicked from room (${scenario}), redirecting to homepage`,
        {
          component: 'executeKick',
          action: 'kick',
          extra: { scenario },
        },
        'warning',
      );
    }

    // Cleanup room State
    const { setRoomId, setRoomName } = useLocalstorageStore.getState();
    setRoomId(null);
    setRoomName(null);

    // Play leave sound for kick
    playSound('leave');

    // Show notification about being kicked
    notify({
      color: 'red',
      title: 'Kicked from room',
      message: 'You have been removed from the room',
      autoClose: false,
    });

    // Use router if provided, otherwise fallback to window.location
    setTimeout(() => {
      if (router) {
        router
          .push('/')
          .then(() => {
            addBreadcrumb('Navigation after kick successful', 'navigation');
          })
          .catch((error) => {
            captureError(
              error instanceof Error
                ? error
                : new Error('Failed to navigate after kick'),
              {
                component: 'executeKick',
                action: 'navigate',
                extra: { scenario },
              },
              'medium',
            );
          });
      } else if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }, 200);
  } catch (error) {
    captureError(
      error instanceof Error ? error : new Error('Failed to execute kick'),
      {
        component: 'executeKick',
        action: 'kick',
        extra: { scenario },
      },
      'high',
    );
  }
}

export function executeRoomNameChange({
  newRoomName,
  router,
}: {
  newRoomName: string;
  router?: NextRouter;
}): void {
  try {
    addBreadcrumb('Executing room name change', 'room', {
      newRoomName,
      hasRouter: !!router,
    });

    // Update local storage with new room name
    const { setRoomName, setRecentRoom } = useLocalstorageStore.getState();
    setRoomName(newRoomName);
    setRecentRoom(newRoomName);

    // Show notification about room name change
    notify({
      color: 'blue',
      title: 'Room name changed',
      message: `Room name updated to: ${newRoomName.toUpperCase()}. Dont forget to update your bookmark.`,
    });

    // Navigate to new room URL
    if (router) {
      router
        .push(`/room/${newRoomName}`)
        .then(() => {
          addBreadcrumb('Navigation to renamed room successful', 'navigation');
        })
        .catch((error) => {
          captureError(
            error instanceof Error
              ? error
              : new Error('Failed to navigate to renamed room'),
            {
              component: 'executeRoomNameChange',
              action: 'navigate',
              extra: { newRoomName },
            },
            'medium',
          );
        });
    } else if (typeof window !== 'undefined') {
      window.location.href = `/room/${newRoomName}`;
    }
  } catch (error) {
    captureError(
      error instanceof Error
        ? error
        : new Error('Failed to execute room name change'),
      {
        component: 'executeRoomNameChange',
        action: 'changeRoomName',
        extra: { newRoomName },
      },
      'high',
    );
  }
}
