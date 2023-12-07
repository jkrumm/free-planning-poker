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
import shortUUID from "short-uuid";

const RoomWrapper = () => {
  const router = useRouter();
  const logger = useLogger().with({ route: RouteType.ROOM });

  console.log("room-wrapper.tsx: const RoomWrapper = () => {");

  configureAbly({
    authUrl: `${env.NEXT_PUBLIC_API_ROOT}api/ably-token`,
    clientId: shortUUID().generate().toString(),
  });

  console.log("room-wrapper.tsx: configureAbly({");

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
    console.log("room-wrapper.tsx: useEffect(() => {");
    let willLeave = false;
    if (!firstLoad && queryRoom) {
      console.log(
        "room-wrapper.tsx: useEffect(() => { if (!firstLoad && queryRoom) {",
      );
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
        if (
          room &&
          room.replace(/[^A-Za-z0-9]/g, "").length >= 3 &&
          room.replace(/[^A-Za-z0-9]/g, "").length <= 15
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
        // return <Loader variant="bars" />;
        return <h1>TEST</h1>;
      })()}
    </main>
  );
};

export default RoomWrapper;
