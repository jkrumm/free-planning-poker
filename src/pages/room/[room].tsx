import Head from "next/head";
import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { getUsername, setLocalstorageRoom } from "~/store/local-storage";
import { UsernameModel } from "~/components/username-model";
import { usePlausible } from "next-plausible";
import { PlausibleEvents } from "~/utils/plausible.events";
import dynamic from "next/dynamic";
import { useWsStore } from "~/store/ws-store";
import { Table } from "~/components/table";
import { WebsocketReceiver } from "~/components/websocket-receiver";
import { Interactions } from "~/components/interactions";

const RoomPage = () => {
  const router = useRouter();
  const room = router.query.room as string;
  const [firstLoad, setFirstLoad] = React.useState(true);

  const plausible = usePlausible<PlausibleEvents>();

  const username = useWsStore((store) => store.username);
  const setUsername = useWsStore((store) => store.setUsername);
  const [modelOpen, setModelOpen] = React.useState(false);

  useEffect(() => {
    if ((!room || room === "undefined") && !firstLoad) {
      setLocalstorageRoom(null);
      router.push(`/`).then(() => {
        return;
      });
    }
    setFirstLoad(false);
    plausible("entered", { props: { room } });

    if (!username) {
      const localStorageUsername = getUsername();
      if (localStorageUsername) {
        setUsername(localStorageUsername);
      } else {
        setModelOpen(true);
      }
    }
  }, [room]);

  return (
    <>
      <Head>
        <title>Planning Poker - {room && room.toUpperCase()}</title>
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
      <main className="relative flex max-h-screen min-h-screen max-w-[100vw] flex-col items-center justify-center overscroll-none">
        <div>
          {(function () {
            if (!room) {
              return "Loading...";
            }
            if (!username || modelOpen) {
              return (
                <UsernameModel
                  modelOpen={modelOpen}
                  setModelOpen={setModelOpen}
                  room={room}
                  username={username}
                  setUsername={setUsername}
                />
              );
            }
            return (
              <>
                <WebsocketReceiver username={username} room={room} />
                <Table room={room} username={username} />
                <Interactions room={room} username={username} />
              </>
            );
          })()}
        </div>
      </main>
    </>
  );
};

export default dynamic(() => Promise.resolve(RoomPage), {
  ssr: false,
});
