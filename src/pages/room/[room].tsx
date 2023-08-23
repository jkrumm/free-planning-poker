import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { UsernameModel } from "fpp/components/room/username-model";
import dynamic from "next/dynamic";
import { Table } from "fpp/components/room/table";
import { WebsocketReceiver } from "fpp/components/room/websocket-receiver";
import { Interactions } from "fpp/components/room/interactions";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
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
import Head from "next/head";

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
      <Head>
        <meta
          name="description"
          content="The fastest and easiest tool to estimate your story points. Simple and free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>{`Free Planning Poker - ${room}`}</title>
        <meta
          property="og:description"
          content="The fastest and easiest tool to estimate your story points. Simple and free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:url" content="https://free-planning-poker.com/" />
        <meta
          property="og:image"
          content="https://free-planning-poker.com/free-planning-poker.jpg"
        />
        <meta
          property="og:image:secure_url"
          content="https://free-planning-poker.com/free-planning-poker.jpg"
        />
        <meta property="og:image:type" content="image/jpg" />
        <meta property="og:image:width" content="1034" />
        <meta property="og:image:height" content="612" />
        <meta property="og:image:alt" content="Free Planning Poker" />
        <meta charSet="utf-8" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#1971c2" />
        <meta name="msapplication-TileColor" content="#1a1b1e" />
        <meta name="theme-color" content="#1a1b1e" />
      </Head>
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
