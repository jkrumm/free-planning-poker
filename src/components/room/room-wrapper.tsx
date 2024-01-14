"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { UsernameModel } from "fpp/components/room/username-model";
import { Table } from "fpp/components/room/table";
import { WebsocketReceiver } from "fpp/components/room/websocket-receiver";
import { Interactions } from "fpp/components/room/interactions";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { sendTrackPageView } from "fpp/hooks/use-tracking.hook";
import { useLogger } from "next-axiom";
import { logMsg, roomEvent } from "fpp/constants/logging.constant";
import { type ClientLog } from "fpp/constants/error.constant";
import { api } from "fpp/utils/api";
import { RouteType } from "fpp/server/db/schema";
import { configureAbly } from "@ably-labs/react-hooks";
import { env } from "fpp/env.mjs";
import { Loader } from "@mantine/core";

const RoomWrapper = () => {
  const router = useRouter();
  const logger = useLogger().with({ route: RouteType.ROOM });

  const username = useLocalstorageStore((store) => store.username);
  const userId = useLocalstorageStore((state) => state.userId);
  const setUserId = useLocalstorageStore((state) => state.setUserId);

  if (userId) {
    configureAbly({
      authUrl: `${env.NEXT_PUBLIC_API_ROOT}api/ably-token`,
      clientId: userId,
    });
  }

  const joinRoomMutation = api.room.joinRoom.useMutation();
  const queryRoom = router.query.room as string;
  const roomId = useLocalstorageStore((store) => store.roomId);
  const setRoomId = useLocalstorageStore((store) => store.setRoomId);
  const roomReadable = useLocalstorageStore((store) => store.roomReadable);
  const setRoomReadable = useLocalstorageStore(
    (store) => store.setRoomReadable,
  );
  const setRecentRoom = useLocalstorageStore((store) => store.setRecentRoom);

  const setVoting = useLocalstorageStore((store) => store.setVoting);
  const setSpectator = useLocalstorageStore((store) => store.setSpectator);

  const [firstLoad, setFirstLoad] = React.useState(true);
  const [modelOpen, setModelOpen] = React.useState(false);

  useEffect(() => {
    let willLeave = false;
    if (!firstLoad && queryRoom) {
      const correctedRoom = queryRoom
        .replace(/[^A-Za-z0-9]/g, "")
        .toLowerCase();
      if (
        window.innerWidth < 768 ||
        !queryRoom ||
        queryRoom === "undefined" ||
        !correctedRoom ||
        correctedRoom.length < 3 ||
        correctedRoom.length > 15
      ) {
        willLeave = true;
        setRoomId(null);
        setRoomReadable(null);
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
        // TODO: FIX BELOW
        // setRoomId(null);
        setRoomReadable(correctedRoom);
        setRecentRoom(correctedRoom);
        router
          .push(`/room/${correctedRoom}`)
          .then(() => ({}))
          .catch(() => ({}));
      }

      if (willLeave) {
        return;
      }

      if (queryRoom !== roomReadable) {
        const logPayload: ClientLog = {
          userId,
          event: roomEvent.ENTER_DIRECTLY,
          roomReadable: queryRoom,
          route: RouteType.ROOM,
        };
        logger.info(logMsg.TRACK_ROOM_EVENT, logPayload);
      }

      joinRoomMutation.mutate(
        { roomReadable: queryRoom },
        {
          onSuccess: (data) => {
            setRoomId(data.roomId);
            setRoomReadable(data.roomReadable);
            setRecentRoom(data.roomReadable);
            setVoting(null);
            setSpectator(false);
            sendTrackPageView({
              userId,
              route: RouteType.ROOM,
              roomId: data.roomId,
              setUserId,
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
        if (roomId && roomReadable) {
          return (
            <>
              <WebsocketReceiver
                username={username}
                roomId={roomId}
                logger={logger}
              />
              <Table roomId={roomId} username={username} logger={logger} />
              <Interactions
                roomId={roomId}
                roomReadable={roomReadable}
                username={username}
                logger={logger}
              />
            </>
          );
        }
        return <Loader variant="bars" />;
      })()}
    </main>
  );
};

export default RoomWrapper;
