import Head from "next/head";
import { signIn, signOut, useSession } from "next-auth/react";

import { api } from "~/utils/api";
import React, { useEffect, useState } from "react";
import { NextPage } from "next";
import { Autocomplete, Button, TextInput } from "@mantine/core";
import { Hero } from "~/components/hero";
import randomWords from "random-words";
import { usePageStore } from "~/store/page-store";
import { getUsername } from "~/store/local-storage";
import { useRouter } from "next/router";

const Home: NextPage = () => {
  const router = useRouter();
  const unusedRooms =
    api.room.getRoomList.useQuery().data ||
    randomWords({ exactly: 500, maxLength: 7 });
  const activeRooms = api.room.getActiveRooms.useQuery().data || [];

  const username = usePageStore((store) => store.username);
  const setUsername = usePageStore((store) => store.setUsername);

  const [roomName, setRoomName] = useState("");
  const [buttonText, setButtonText] = useState("Create random room");
  const [error, setError] = useState(false);

  useEffect(() => {
    const localstorageUsername = getUsername();
    if (localstorageUsername) {
      setUsername(localstorageUsername);
    }
    console.log(username);
  }, []);

  useEffect(() => {
    if (roomName === unusedRooms[0] || roomName === "") {
      setButtonText(`Create random room: `);
      setRoomName(unusedRooms[0] || "");
    } else if (activeRooms.includes(roomName)) {
      setButtonText(`Join room: `);
    } else {
      setButtonText(`Create room: `);
    }
    console.log(activeRooms);
  }, [roomName]);

  return (
    <>
      <Head>
        <title>Create T3 App</title>
        <meta name="description" content="Generated by create-t3-app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center">
        <Hero />
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
          {/*<Card withBorder radius="md" p="xl" className={classes.card}>*/}
          {/*  <Text size="lg" className="mb-5" weight={500}>*/}
          {/*    Create Room*/}
          {/*  </Text>*/}

          {/*<InputWrapper label="Your name">*/}
          {/*  <Input />*/}
          {/*</InputWrapper>*/}

          <TextInput
            label="Your name"
            error={error && "Required"}
            size="xl"
            withAsterisk
            value={username || ""}
            onChange={(event) => {
              setError(false);
              setUsername(event.currentTarget.value);
            }}
          />

          <Autocomplete
            label="Your room"
            placeholder={roomName}
            className="mb-6"
            size="xl"
            limit={3}
            onChange={setRoomName}
            data={activeRooms}
          />

          {/*<Link href={`/room/${roomName}`}>*/}
          <Button
            variant="gradient"
            gradient={
              username
                ? { from: "blue", to: "cyan" }
                : { from: "#373A40", to: "#373A40" }
            }
            size="xl"
            className={`mb-8 px-10 ${!username && "text-gray-900"}`}
            uppercase
            // value={username || ""}
            // disabled={!username}
            onClick={async () => {
              if (!username) {
                setError(true);
              } else {
                await router.push(`/room/${roomName}`);
              }
            }}
          >
            {buttonText}&nbsp;<strong>{roomName}</strong>
          </Button>
          {/*</Link>*/}

          {/*</Card>*/}
          {/*<div className="flex flex-col items-center gap-2">*/}
          {/*  <p className="text-2xl">*/}
          {/*    {hello.data ? hello.data.greeting : "Loading tRPC query..."}*/}
          {/*  </p>*/}
          {/*  <AuthShowcase />*/}
          {/*</div>*/}
        </div>
      </main>
    </>
  );
};

export default Home;

const AuthShowcase: React.FC = () => {
  const { data: sessionData } = useSession();

  const { data: secretMessage } = api.example.getSecretMessage.useQuery(
    undefined, // no input
    { enabled: sessionData?.user !== undefined }
  );

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl">
        {sessionData && <span>Logged in as {sessionData.user?.name}</span>}
        {secretMessage && <span> - {secretMessage}</span>}
      </p>
      <button
        className="rounded-full py-3 font-semibold no-underline transition"
        onClick={sessionData ? () => void signOut() : () => void signIn()}
      >
        {sessionData ? "Sign out" : "Sign in"}
      </button>
    </div>
  );
};
