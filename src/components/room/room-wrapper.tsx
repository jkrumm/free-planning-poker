'use client';

import React, { useEffect } from 'react';

import { useRouter } from 'next/router';

import { Loader } from '@mantine/core';

import { api } from 'fpp/utils/api';
import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import { useLocalstorageStore } from 'fpp/store/local-storage.store';
import { useRoomStore } from 'fpp/store/room.store';

import { RouteType } from 'fpp/server/db/schema';

import { sendTrackPageView } from 'fpp/hooks/use-tracking.hook';

import { Room } from 'fpp/components/room/room';
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
    // Add overflow-hidden to body when component mounts
    document.documentElement.classList.add('overflow-hidden');
    document.documentElement.classList.add('max-h-screen');
    document.documentElement.classList.add('scrollbar-hide');

    // Remove overflow-hidden when component unmounts
    return () => {
      document.documentElement.classList.remove('overflow-hidden');
      document.documentElement.classList.remove('max-h-screen');
      document.documentElement.classList.remove('scrollbar-hide');
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
              source: null,
              setUserIdLocalStorage,
              setUserIdRoomState,
            });
          },
        },
      );
    }

    setFirstLoad(false);

    if (!username) {
      setModelOpen(true);
    }
  }, [queryRoom, username, firstLoad]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center relative">
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
            <Room
              roomId={roomId}
              roomName={roomName}
              userId={userId}
              username={username}
            />
          );
        }
        return <Loader variant="bars" />;
      })()}
    </div>
  );
};

export default RoomWrapper;
