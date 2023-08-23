"use client";

import { useRouter } from "next/router";
import { useLogger } from "next-axiom";
import { RouteType } from "@prisma/client";
import { configureAbly } from "@ably-labs/react-hooks";
import { env } from "fpp/env.mjs";
import shortUUID from "short-uuid";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { api } from "fpp/utils/api";
import React, { useEffect } from "react";
import { type ClientLog } from "fpp/constants/error.constant";
import { logMsg, roomEvent } from "fpp/constants/logging.constant";
import { sendTrackPageView } from "fpp/hooks/use-tracking.hook";
import { Loader } from "@mantine/core";
import { UsernameModel } from "fpp/components/room/username-model";
import { WebsocketReceiver } from "fpp/components/room/websocket-receiver";
import { Table } from "fpp/components/room/table";
import { Interactions } from "fpp/components/room/interactions";

const RoomWrapper = () => {
  const router = useRouter();
  const logger = useLogger().with({ route: RouteType.ROOM });

  configureAbly({
    authUrl: `${env.NEXT_PUBLIC_API_ROOT}api/ably-token`,
    clientId: shortUUID().generate().toString(),
  });

  const username = useLocalstorageStore((store) => store.username);
  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);

  const setRoomMutation = api.room.setRoom.useMutation();
  const queryRoom = router.query.room as string;
  const room = useLocalstorageStore((store) => store.room);
  const setRoom = useLocalstorageStore((store) => store.setRoom);
  const setRecentRoom = useLocalstorageStore((store) => store.setRecentRoom);

  const setVoting = useLocalstorageStore((store) => store.setVoting);
  const setSpectator = useLocalstorageStore((store) => store.setSpectator);

  const [firstLoad, setFirstLoad] = React.useState(true);
  const [modelOpen, setModelOpen] = React.useState(false);

  useEffect(() => {
    let willLeave = false;
    if (!firstLoad && queryRoom) {
      const correctedRoom = queryRoom.replace(/[^A-Za-z]/g, "").toLowerCase();
      if (
        window.innerWidth < 768 ||
        !queryRoom ||
        queryRoom === "undefined" ||
        !correctedRoom ||
        correctedRoom.length < 3 ||
        correctedRoom.length > 15
      ) {
        willLeave = true;
        setRoom(null);
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
        setRoom(correctedRoom);
        setRecentRoom(correctedRoom);
        router
          .push(`/room/${correctedRoom}`)
          .then(() => ({}))
          .catch(() => ({}));
      }

      if (willLeave) {
        return;
      }

      if (queryRoom !== room) {
        const logPayload: ClientLog = {
          visitorId,
          event: roomEvent.ENTER_DIRECTLY,
          room: room ?? queryRoom,
          route: RouteType.ROOM,
        };
        logger.info(logMsg.TRACK_ROOM_EVENT, logPayload);
      }

      setRoom(queryRoom);
      setRecentRoom(queryRoom);
      setRoomMutation.mutate({ room: queryRoom });
      setVoting(null);
      setSpectator(false);

      sendTrackPageView({
        visitorId,
        route: RouteType.ROOM,
        room: queryRoom,
        setVisitorId,
        logger,
      });
    }

    setFirstLoad(false);
    logger.with({ visitorId, room: room ?? queryRoom, queryRoom });

    if (!username) {
      setModelOpen(true);
    }
  }, [queryRoom, username, firstLoad]);

  return (
    <>
      <main className="relative flex max-h-screen min-h-screen flex-col items-center justify-center overscroll-none">
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
          if (
            room &&
            room.replace(/[^A-Za-z]/g, "").length >= 3 &&
            room.replace(/[^A-Za-z]/g, "").length <= 15
          ) {
            return (
              <>
                <WebsocketReceiver
                  username={username}
                  room={room}
                  logger={logger}
                />
                <Table room={room} username={username} logger={logger} />
                <Interactions room={room} username={username} logger={logger} />
              </>
            );
          }
          return <Loader variant="bars" />;
        })()}
      </main>
    </>
  );
};

export default RoomWrapper;
