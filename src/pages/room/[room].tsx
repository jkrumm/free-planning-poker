import Head from "next/head";
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { UsernameModel } from "fpp/components/username-model";
import { usePlausible } from "next-plausible";
import { type PlausibleEvents } from "fpp/utils/plausible.events";
import dynamic from "next/dynamic";
import { Table } from "fpp/components/table";
import { WebsocketReceiver } from "fpp/components/websocket-receiver";
import { Interactions } from "fpp/components/interactions";
import { api } from "fpp/utils/api";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import Link from "next/link";
import { EventType } from ".prisma/client";

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

  const plausible = usePlausible<PlausibleEvents>();

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
        { visitorId, route: "ROOM", room: queryRoom },
        {
          onSuccess: (visitorId) => {
            setVisitorId(visitorId);
          },
        }
      );
    }

    setFirstLoad(false);
    plausible("entered", { props: { room: queryRoom } });

    if (!username) {
      setModelOpen(true);
    } else {
      setVoting(null);
      setSpectator(false);
    }
  }, [queryRoom]);

  return (
    <>
      <Head>
        {/* eslint-disable-next-line @typescript-eslint/prefer-optional-chain */}
        <title>Planning Poker - {queryRoom && queryRoom.toUpperCase()}</title>
        <meta
          name="description"
          content="Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        <meta property="og:title" content="Free Planning Poker" />
        <meta
          property="og:description"
          content="Estimate your story points faster and easier with this free agile scrum sprint planning poker app. Open source and privacy focused."
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
