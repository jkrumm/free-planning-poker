import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { UsernameModel } from "fpp/components/room/username-model";
import dynamic from "next/dynamic";
import { Table } from "fpp/components/room/table";
import { WebsocketReceiver } from "fpp/components/room/websocket-receiver";
import { Interactions } from "fpp/components/room/interactions";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import Link from "next/link";
import { Meta } from "fpp/components/meta";
import { RouteType } from "@prisma/client";
import { sendTrackPageView } from "fpp/hooks/use-tracking.hook";
import { useLogger } from "next-axiom";
import { logMsg, roomEvent } from "fpp/constants/logging.constant";
import { type ClientLog } from "fpp/constants/error.constant";

const RoomPage = () => {
  const router = useRouter();
  const log = useLogger();

  const username = useLocalstorageStore((store) => store.username);
  const setVoting = useLocalstorageStore((store) => store.setVoting);
  const setSpectator = useLocalstorageStore((store) => store.setSpectator);
  const room = useLocalstorageStore((store) => store.room);
  const setRoom = useLocalstorageStore((store) => store.setRoom);
  const setRecentRoom = useLocalstorageStore((store) => store.setRecentRoom);
  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);

  const queryRoom = router.query.room as string;

  const [firstLoad, setFirstLoad] = React.useState(true);
  const [modelOpen, setModelOpen] = React.useState(false);

  useEffect(() => {
    let willLeave = false;
    if (!firstLoad && queryRoom) {
      const correctedRoom = queryRoom.replace(/[^A-Za-z]/g, "").toLowerCase();
      if (
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
        log.info(logMsg.TRACK_ROOM_EVENT, logPayload);
      }

      setRoom(queryRoom);
      setRecentRoom(queryRoom);
      setVoting(null);
      setSpectator(false);

      sendTrackPageView({
        visitorId,
        route: RouteType.ROOM,
        room: queryRoom,
        setVisitorId,
      });
    }

    setFirstLoad(false);

    if (!username) {
      setModelOpen(true);
    }
  }, [queryRoom, username, firstLoad]);

  return (
    <>
      <Meta title={room} robots="noindex,nofollow" />
      <main className="relative flex max-h-screen min-h-screen min-w-[1200px] flex-col items-center justify-center overscroll-none">
        <div>
          {(function () {
            if (
              firstLoad ||
              !queryRoom ||
              queryRoom.replace(/[^A-Za-z]/g, "").length < 3 ||
              queryRoom.replace(/[^A-Za-z]/g, "").length > 15
            ) {
              return "Loading...";
            }
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
                  <WebsocketReceiver username={username} room={room} />
                  <Table room={room} username={username} />
                  <Interactions room={room} username={username} log={log} />
                </>
              );
            } else {
              return (
                <div className="flex flex-col items-center justify-center">
                  <h1 className="text-center text-3xl">
                    Room not found. <Link href="/">Go back home</Link>
                  </h1>
                </div>
              );
            }
          })()}
        </div>
      </main>
    </>
  );
};

export default dynamic(() => Promise.resolve(RoomPage), {
  ssr: false,
});
