import Head from "next/head";

import { api } from "~/utils/api";
import React, { useEffect, useState } from "react";
import { type NextPage } from "next";
import { Autocomplete, Button, TextInput } from "@mantine/core";
import { Hero } from "~/components/hero";
import randomWords from "random-words";
import {
  getLocalstorageRecentRoom,
  getLocalstorageRoom,
  getUsername,
  setLocalstorageRoom,
  setUsername,
} from "~/store/local-storage";
import { useRouter } from "next/router";
import { usePlausible } from "next-plausible";
import { type PlausibleEvents } from "~/utils/plausible.events";
import { log } from "~/utils/console-log";

const Home: NextPage = () => {
  const router = useRouter();
  const randomRoom =
    api.room.getRandomRoom.useQuery().data || randomWords({ exactly: 1 })[0];
  const activeRooms = api.room.getActiveRooms.useQuery().data || [];

  const username = getUsername();

  const [localUsername, setLocalUsername] = useState(username || "");
  const [roomName, setRoomName] = useState("");
  const [recentRoom, setRecentRoom] = useState<string | null>(null);
  const [buttonText, setButtonText] = useState("Create random room");
  const [error, setError] = useState(false);

  const plausible = usePlausible<PlausibleEvents>();

  useEffect(() => {
    const localStorageRoom = getLocalstorageRoom();
    if (
      !localStorageRoom ||
      localStorageRoom === "null" ||
      localStorageRoom === "undefined"
    ) {
      setLocalstorageRoom(null);
    } else {
      router
        .push(`/room/${localStorageRoom}`)
        .then(() => ({}))
        .catch(() => ({}));
    }
    setRecentRoom(getLocalstorageRecentRoom());
    log("recentRoom", { recentRoom });
  }, [recentRoom]);

  useEffect(() => {
    if (roomName === randomRoom || roomName === "") {
      setButtonText(`Create random room: `);
      setRoomName(randomRoom || "");
    } else if (activeRooms.includes(roomName)) {
      setButtonText(`Join room: `);
    } else {
      setButtonText(`Create room: `);
    }
  }, [roomName]);

  return (
    <>
      <Head>
        <title>Free Planning Poker</title>
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
      <main className="flex min-h-screen flex-col items-center justify-center">
        <Hero />
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
          {recentRoom && (
            <Button
              variant="gradient"
              gradient={{ from: "blue", to: "cyan" }}
              size="xl"
              className={`my-8 mb-12 w-[480px] px-0`}
              type="button"
              uppercase
              disabled={!username && username?.length === 0}
              onClick={async (e) => {
                if (!recentRoom) {
                  // TODO sentry
                  return;
                }
                const localRoom = recentRoom;
                e.preventDefault();
                if (!username) {
                  setError(true);
                }
                plausible("recent", {
                  props: { room: localRoom.toLowerCase() },
                });
                await router.push(`/room/${localRoom.toLowerCase()}`);
              }}
            >
              Join recent room: &nbsp;<strong>{recentRoom}</strong>
            </Button>
          )}
          <form>
            <TextInput
              label="Username"
              error={error && "Required"}
              size="xl"
              withAsterisk
              value={localUsername}
              onChange={(event) => {
                setError(false);
                setLocalUsername(event.currentTarget.value.trim());
              }}
            />

            <Autocomplete
              label="Room"
              placeholder={roomName}
              className="my-6"
              size="xl"
              limit={3}
              onChange={(e) => {
                if (e.length <= 15) {
                  setRoomName(e.toLowerCase().trim());
                }
              }}
              value={roomName}
              data={roomName.length > 1 ? activeRooms : []}
            />

            <Button
              variant="gradient"
              gradient={{ from: "blue", to: "cyan" }}
              size="xl"
              className={`my-8 w-[380px] px-0`}
              type="submit"
              uppercase
              disabled={!username && username?.length === 0}
              onClick={async (e) => {
                e.preventDefault();
                if (!localUsername) {
                  setError(true);
                } else {
                  setUsername(localUsername);
                  if (activeRooms.includes(roomName.toLowerCase())) {
                    plausible("joined", {
                      props: { room: roomName.toLowerCase() },
                    });
                  } else {
                    plausible("created", {
                      props: { room: roomName.toLowerCase() },
                    });
                  }
                  await router.push(`/room/${roomName.toLowerCase()}`);
                }
              }}
            >
              {buttonText}&nbsp;<strong>{roomName}</strong>
            </Button>
          </form>
        </div>
      </main>
    </>
  );
};

export default Home;

// const AuthShowcase: React.FC = () => {
//   const { data: sessionData } = useSession();
//
//   const { data: secretMessage } = api.example.getSecretMessage.useQuery(
//     undefined, // no input
//     { enabled: sessionData?.user !== undefined }
//   );
//
//   return (
//     <div className="flex flex-col items-center justify-center gap-4">
//       <p className="text-center text-2xl">
//         {sessionData && <span>Logged in as {sessionData.user?.name}</span>}
//         {secretMessage && <span> - {secretMessage}</span>}
//       </p>
//       <button
//         className="rounded-full py-3 font-semibold no-underline transition"
//         onClick={sessionData ? () => void signOut() : () => void signIn()}
//       >
//         {sessionData ? "Sign out" : "Sign in"}
//       </button>
//     </div>
//   );
// };
