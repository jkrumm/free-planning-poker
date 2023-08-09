import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { UsernameModel } from "fpp/components/room/username-model";
import dynamic from "next/dynamic";
import { Table } from "fpp/components/room/table";
import { WebsocketReceiver } from "fpp/components/room/websocket-receiver";
import { Interactions } from "fpp/components/room/interactions";
import { api } from "fpp/utils/api";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import Link from "next/link";
import { EventType } from ".prisma/client";
import { Meta } from "fpp/components/meta";
import { log } from "fpp/utils/console-log";
import { RouteType } from "@prisma/client";

const RoomPage = () => {
  const router = useRouter();

  const username = useLocalstorageStore((store) => store.username);
  const setVoting = useLocalstorageStore((store) => store.setVoting);
  const setSpectator = useLocalstorageStore((store) => store.setSpectator);
  const room = useLocalstorageStore((store) => store.room);
  const setRoom = useLocalstorageStore((store) => store.setRoom);
  const setRecentRoom = useLocalstorageStore((store) => store.setRecentRoom);
  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);
  const trackPageViewMutation = api.tracking.trackPageView.useMutation();
  const sendEvent = api.tracking.trackEvent.useMutation();

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

      setRoom(queryRoom);
      setRecentRoom(queryRoom);

      sendEvent.mutate({
        visitorId,
        type: EventType.ENTER_DIRECTLY,
      });
      trackPageViewMutation.mutate(
        { visitorId, route: RouteType.ROOM, room: queryRoom },
        {
          onSuccess: (visitorId) => {
            setVisitorId(visitorId);
            log("useTrackPageView", {
              visitorId,
              route: RouteType.ROOM,
              room,
            });
          },
        }
      );
    }

    setFirstLoad(false);

    if (!username) {
      setModelOpen(true);
    } else {
      setVoting(null);
      setSpectator(false);
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
                  <Interactions room={room} username={username} />
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
