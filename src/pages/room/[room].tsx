import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { UsernameModel } from "fpp/components/room/username-model";
import dynamic from "next/dynamic";
import { Table } from "fpp/components/room/table";
import { WebsocketReceiver } from "fpp/components/room/websocket-receiver";
import { Interactions } from "fpp/components/room/interactions";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import { Meta } from "fpp/components/meta";
import { RouteType } from "@prisma/client";
import { sendTrackPageView } from "fpp/hooks/use-tracking.hook";
import { useLogger } from "next-axiom";
import { logMsg, roomEvent } from "fpp/constants/logging.constant";
import { type ClientLog } from "fpp/constants/error.constant";
import { api } from "fpp/utils/api";
import { configureAbly } from "@ably-labs/react-hooks";
import { env } from "fpp/env.mjs";
import shortUUID from "short-uuid";
import { Alert, Button, Loader, Text } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import Link from "next/link";

const RoomPage = () => {
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
      <Meta title={room} robots="noindex,nofollow" />
      <div className="m-8 md:hidden">
        <Alert
          icon={<IconAlertCircle size="1rem" />}
          title="Not supported on mobile devices"
          color="orange"
          variant="outline"
        >
          <Text>
            Free-Planning-Poker.com is not supported on mobile devices. Please
            use a larger device or increase the size of your browser window.
          </Text>
          <Link href="/">
            <Button className="mt-4 block">Back to homepage</Button>
          </Link>
        </Alert>
      </div>
      <main className="relative hidden max-h-screen min-h-screen min-w-[1200px] flex-col items-center justify-center overscroll-none md:flex">
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

export default dynamic(() => Promise.resolve(RoomPage), {
  ssr: false,
});
