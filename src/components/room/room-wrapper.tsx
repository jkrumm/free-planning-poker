'use client';

import React, { useEffect } from 'react';

import { useRouter } from 'next/router';

import { Loader } from '@mantine/core';

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
  const setUserIdRoomState = useRoomStore((state) => state.setUserId);

  if (validateNanoId(userId)) {
    setUserIdRoomState(userId!);
  }

  const joinRoomMutation = api.room.joinRoom.useMutation({
    onError: (error) => {
      captureError(
        error,
        {
          component: 'RoomWrapper',
          action: 'joinRoom',
        },
        'high',
      );
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
            });
          },
        },
      );
    }

    if (typeof window !== 'undefined') {
      initializeAudioContext();
    }

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
                  />
                </ErrorBoundary>
              );
            }
            return <Loader variant="bars" />;
          })()}
        </div>
      </SentryContextProvider>
    </ErrorBoundary>
  );
};

export default RoomWrapper;
