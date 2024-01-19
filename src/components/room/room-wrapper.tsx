'use client';

import React, { useEffect } from 'react';

import { useRouter } from 'next/router';

import { env } from 'fpp/env.mjs';

import { Loader } from '@mantine/core';

import * as Ably from 'ably';
import { AblyProvider } from 'ably/react';
import { useLogger } from 'next-axiom';

import { api } from 'fpp/utils/api';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';
import { useRoomStateStore } from 'fpp/store/room-state.store';

import { RouteType } from 'fpp/server/db/schema';

import { sendTrackPageView } from 'fpp/hooks/use-tracking.hook';

import { Room } from 'fpp/components/room/room';
import { UsernameModel } from 'fpp/components/room/username-model';

const RoomWrapper = () => {
  const router = useRouter();
  const logger = useLogger().with({ route: RouteType.ROOM });

  const username = useLocalstorageStore((store) => store.username);
  const userId = useLocalstorageStore((state) => state.userId);
  const setUserIdLocalStorage = useLocalstorageStore(
    (state) => state.setUserId,
  );

  const setUserIdRoomState = useRoomStateStore((state) => state.setUserId);
  if (validateNanoId(userId)) {
    setUserIdRoomState(userId!);
  }

  let ablyClient;
  if (validateNanoId(userId)) {
    ablyClient = new Ably.Realtime.Promise({
      authUrl: `${env.NEXT_PUBLIC_API_ROOT}api/ably-token`,
      clientId: userId!,
    });
  }

  const joinRoomMutation = api.room.joinRoom.useMutation();
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
    let willLeave = false;
    if (!firstLoad && queryRoom) {
      const correctedRoom = queryRoom
        .replace(/[^A-Za-z0-9]/g, '')
        .toLowerCase();
      if (
        window.innerWidth < 768 ||
        !queryRoom ||
        queryRoom === 'undefined' ||
        !correctedRoom ||
        correctedRoom.length < 3 ||
        correctedRoom.length > 15
      ) {
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
              setUserIdLocalStorage,
              setUserIdRoomState,
              logger,
            });
          },
        },
      );
    }

    setFirstLoad(false);
    logger.with({ userId, roomId });

    if (!username) {
      setModelOpen(true);
    }
  }, [queryRoom, username, firstLoad]);

  return (
    <main className="relative hidden max-h-screen min-h-screen flex-col items-center justify-center overscroll-none md:flex">
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
        if (roomId && userId && ablyClient && roomName) {
          return (
            <AblyProvider client={ablyClient}>
              <Room
                roomId={roomId}
                roomName={roomName}
                userId={userId}
                username={username}
                logger={logger}
              />
            </AblyProvider>
          );
        }
        return <Loader variant="bars" />;
      })()}
    </main>
  );
};

export default RoomWrapper;
