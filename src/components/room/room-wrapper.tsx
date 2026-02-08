'use client';

import React, { useEffect, useRef } from 'react';

import { useRouter } from 'next/router';

import { Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { api } from 'fpp/utils/api';
import { addBreadcrumb, captureError } from 'fpp/utils/app-error';
import { initializeAudioContext } from 'fpp/utils/room.util';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';
import { useRoomStore } from 'fpp/store/room.store';

import { RouteType } from 'fpp/server/db/schema';

import { sendTrackPageView } from 'fpp/hooks/use-tracking.hook';

import { ErrorBoundary } from 'fpp/components/room/error-boundry';
import { Room } from 'fpp/components/room/room';
import { SentryContextProvider } from 'fpp/components/room/sentry-context-provider';
import { UsernameModel } from 'fpp/components/room/username-model';

const RoomWrapper = () => {
  const router = useRouter();

  const username = useLocalstorageStore((store) => store.username);
  const userId = useLocalstorageStore((state) => state.userId);
  const setUserIdLocalStorage = useLocalstorageStore(
    (state) => state.setUserId,
  );
  const clearUsername = useLocalstorageStore((state) => state.clearUsername);
  const setUserIdRoomState = useRoomStore((state) => state.setUserId);

  // Retry logic for joinRoom mutation
  const retryCountRef = useRef(0);
  const maxRetries = 5;
  const getRetryDelay = (attempt: number) =>
    Math.min(Math.pow(2, attempt) * 1000, 10000);

  const joinRoomMutation = api.room.joinRoom.useMutation({
    onError: (error) => {
      const currentRetry = retryCountRef.current;

      addBreadcrumb('joinRoom mutation failed', 'mutation', {
        retryAttempt: currentRetry,
        maxRetries,
        errorMessage: error.message,
      });

      if (currentRetry < maxRetries) {
        const delay = getRetryDelay(currentRetry);
        retryCountRef.current += 1;

        addBreadcrumb('Scheduling joinRoom retry', 'mutation', {
          nextRetryAttempt: retryCountRef.current,
          delayMs: delay,
        });

        // Retry after exponential backoff
        setTimeout(() => {
          const queryRoom = router.query.room as string;
          const roomEvent = useLocalstorageStore.getState().roomEvent;
          joinRoomMutation.mutate({ queryRoom, userId, roomEvent });
        }, delay);
      } else {
        // Final failure - capture error and show notification
        captureError(
          error,
          {
            component: 'RoomWrapper',
            action: 'joinRoom',
            extra: {
              totalRetries: maxRetries,
              finalError: error.message,
            },
          },
          'high',
        );

        notifications.show({
          title: 'Connection Error',
          message:
            'Unable to join the room. Please check your connection and try refreshing the page.',
          color: 'red',
          autoClose: 10000,
          withCloseButton: true,
        });

        // Reset retry counter for next attempt
        retryCountRef.current = 0;
      }
    },
  });

  const queryRoom = router.query.room as string;
  const roomId = useLocalstorageStore((store) => store.roomId);
  const setRoomId = useLocalstorageStore((store) => store.setRoomId);
  const roomName = useLocalstorageStore((store) => store.roomName);
  const setRoomName = useLocalstorageStore((store) => store.setRoomName);
  const setRecentRoom = useLocalstorageStore((store) => store.setRecentRoom);
  const roomEvent = useLocalstorageStore((store) => store.roomEvent);

  const [firstLoad, setFirstLoad] = React.useState(true);
  const [modelOpen, setModelOpen] = React.useState(false);

  // Handle invalid username from WebSocket (code 1008)
  const handleInvalidUsername = React.useCallback(() => {
    addBreadcrumb('Invalid username detected - clearing localStorage', 'auth');

    // Clear invalid username from localStorage
    clearUsername();

    // Show username modal for user to enter valid username
    setModelOpen(true);
  }, [clearUsername]);

  // Sync userId to room state when it changes
  useEffect(() => {
    if (validateNanoId(userId)) {
      setUserIdRoomState(userId!);
    }
  }, [userId, setUserIdRoomState]);

  useEffect(() => {
    try {
      // Add overflow-hidden to body when the component mounts
      document.documentElement.classList.add('overflow-hidden');
      document.documentElement.classList.add('max-h-screen');
      document.documentElement.classList.add('scrollbar-hide');

      addBreadcrumb('Room wrapper mounted', 'component');

      // Your existing useEffect logic here...
    } catch (error) {
      captureError(
        error instanceof Error
          ? error
          : new Error('Failed to initialize room wrapper'),
        {
          component: 'RoomWrapper',
          action: 'initialization',
        },
        'high',
      );
    }

    return () => {
      try {
        document.documentElement.classList.remove('overflow-hidden');
        document.documentElement.classList.remove('max-h-screen');
        document.documentElement.classList.remove('scrollbar-hide');
      } catch (error) {
        captureError(
          error instanceof Error
            ? error
            : new Error('Failed to cleanup room wrapper'),
          {
            component: 'RoomWrapper',
            action: 'cleanup',
          },
          'low',
        );
      }
    };
  }, []);

  useEffect(() => {
    let willLeave = false;
    if (!firstLoad && queryRoom) {
      const correctedRoom = queryRoom
        .replace(/[^A-Za-z0-9]/g, '')
        .toLowerCase();
      if (
        !queryRoom ||
        queryRoom === 'undefined' ||
        !correctedRoom ||
        correctedRoom.length < 3 ||
        correctedRoom.length > 15
      ) {
        addBreadcrumb('No room specified', 'room', {
          roomId,
          roomName,
          userId,
        });

        willLeave = true;
        setRoomId(null);
        setRoomName(null);
        setRecentRoom(null);
        router
          .push(`/`)
          .then(() => ({}))
          .catch(() => ({}));
      }

      if (willLeave) {
        return;
      }

      if (queryRoom !== correctedRoom) {
        addBreadcrumb('Needs to correct room URL', 'room', {
          roomId,
          roomName,
          userId,
        });

        willLeave = true;
        setRoomName(correctedRoom);
        setRecentRoom(correctedRoom);
        router
          .push(`/room/${correctedRoom}`)
          .then(() => ({}))
          .catch(() => ({}));
      }

      if (willLeave) {
        return;
      }

      joinRoomMutation.mutate(
        { queryRoom, userId, roomEvent },
        {
          onSuccess: ({ userId, roomId, roomName }) => {
            // Reset retry counter on success
            const hadRetries = retryCountRef.current > 0;
            retryCountRef.current = 0;

            setUserIdLocalStorage(userId);
            setUserIdRoomState(userId);
            setRoomId(roomId);
            setRoomName(roomName);
            setRecentRoom(roomName);

            if (queryRoom !== roomName) {
              router
                .push(`/room/${roomName}`)
                .then(() => ({}))
                .catch(() => ({}));
            }

            sendTrackPageView({
              userId,
              route: RouteType.ROOM,
              roomId,
              source: null,
              setUserIdLocalStorage,
              setUserIdRoomState,
            });

            addBreadcrumb('Successfully joined room', 'room', {
              roomId,
              roomName,
              userId,
              retriesNeeded: hadRetries,
            });
          },
        },
      );
    }

    if (typeof window !== 'undefined') {
      initializeAudioContext();
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid pattern: One-time initialization flag on mount
    setFirstLoad(false);

    if (!username) {
      setModelOpen(true);
    }
  }, [queryRoom, username, firstLoad]);

  return (
    <ErrorBoundary componentName="RoomWrapper">
      <SentryContextProvider
        userId={userId ?? undefined}
        roomId={roomId ?? undefined}
        username={username ?? undefined}
      >
        <div className="flex flex-col items-center justify-center relative">
          {(() => {
            if (!username || modelOpen) {
              return (
                <UsernameModel
                  modelOpen={modelOpen}
                  setModelOpen={setModelOpen}
                  room={queryRoom}
                />
              );
            }
            if (roomId && userId && roomName) {
              return (
                <ErrorBoundary componentName="Room">
                  <Room
                    roomId={roomId}
                    roomName={roomName}
                    userId={userId}
                    username={username}
                    onInvalidUsername={handleInvalidUsername}
                  />
                </ErrorBoundary>
              );
            }
            return (
              <div className="fixed top-0 left-0 flex items-center justify-center z-50 h-screen w-screen">
                <Loader variant="bars" size="xl" />
              </div>
            );
          })()}
        </div>
      </SentryContextProvider>
    </ErrorBoundary>
  );
};

export default RoomWrapper;
