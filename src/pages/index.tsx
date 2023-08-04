import Head from "next/head";

import { api } from "fpp/utils/api";
import React, { useEffect, useState } from "react";
import { type NextPage } from "next";
import {
  Autocomplete,
  Button,
  createStyles,
  Group,
  TextInput,
} from "@mantine/core";
import { Hero } from "fpp/components/hero";
import { generate } from "random-words";
import { useRouter } from "next/router";
import { usePlausible } from "next-plausible";
import { type PlausibleEvents } from "fpp/utils/plausible.events";
import { IconArrowBadgeRightFilled } from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useLocalstorageStore } from "fpp/store/local-storage.store";

const useStyles = createStyles(() => ({
  buttonRight: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  buttonLeft: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
}));

const Home: NextPage = () => {
  const { classes } = useStyles();
  const router = useRouter();

  const username = useLocalstorageStore((state) => state.username);
  const setUsername = useLocalstorageStore((state) => state.setUsername);
  const room = useLocalstorageStore((state) => state.room);
  const setRoom = useLocalstorageStore((state) => state.setRoom);

  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const setVisitorId = useLocalstorageStore((state) => state.setVisitorId);
  const getVisitorId = api.tracking.trackPageView.useMutation();
  useEffect(() => {
    getVisitorId.mutate(
      { visitorId, route: "HOME" },
      {
        onSuccess: (visitorId) => {
          setVisitorId(visitorId);
        },
      }
    );
  }, []);

  const recentRoom = useLocalstorageStore((state) => state.recentRoom);
  const [hasRecentRoom, setHasRecentRoom] = useState(false);
  useEffect(() => {
    if (recentRoom) {
      setHasRecentRoom(true);
    }
  }, [recentRoom]);

  const randomRoom =
    api.room.getRandomRoom.useQuery().data ??
    generate({ minLength: 3, exactly: 1 })[0];
  const activeRooms = api.room.getActiveRooms.useQuery().data ?? [];

  const plausible = usePlausible<PlausibleEvents>();

  useEffect(() => {
    if (!room || room === "null" || room === "undefined") {
      setRoom(null);
    } else {
      router
        .push(`/room/${room}`)
        .then(() => ({}))
        .catch(() => ({}));
    }
  }, [room]);

  const form = useForm({
    initialValues: {
      username: username ?? "",
      room: randomRoom ?? "",
    },
    validate: {
      username: (value) =>
        value.replace(/[^A-Za-z]/g, "").length < 3 ||
        value.replace(/[^A-Za-z]/g, "").length > 15,
      room: (value) =>
        value.replace(/[^A-Za-z]/g, "").length < 3 ||
        value.replace(/[^A-Za-z]/g, "").length > 15,
    },
  });

  const [usernameInvalid, setUsernameInvalid] = useState<boolean>(false);

  useEffect(() => {
    setUsernameInvalid(
      !form.values.username ||
        form.values.username.replace(/[^A-Za-z]/g, "").length < 3
    );
  }, [form.values.username]);

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
      <main className="flex min-h-screen flex-col">
        <Hero />
        <div className="w-full px-4 pb-16">
          {hasRecentRoom && (
            <Button
              variant="gradient"
              gradient={{ from: "blue", to: "cyan" }}
              size="xl"
              className={`mx-auto my-8 block w-[480px]`}
              type="button"
              uppercase
              disabled={usernameInvalid}
              // eslint-disable-next-line @typescript-eslint/no-misused-promises
              onClick={async (e) => {
                setUsername(form.values.username);
                setRoom(recentRoom);
                e.preventDefault();
                /* plausible("recent", {
                props: { room: recentRoom },
              }); */
                await router.push(`/room/${recentRoom}`);
              }}
            >
              Join recent room: &nbsp;<strong>{recentRoom}</strong>
            </Button>
          )}
          <form
            className="mt-8 w-full"
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onSubmit={form.onSubmit(async () => {
              setUsername(form.values.username);
              const roomName = form.values.room
                .replace(/[^A-Za-z]/g, "")
                .toLowerCase();
              if (activeRooms.includes(roomName)) {
                plausible("joined", {
                  props: { room: roomName },
                });
              } else {
                plausible("created", {
                  props: { room: roomName },
                });
              }
              setRoom(roomName);
              await router.push(`/room/${roomName}`);
            })}
          >
            <div className="mx-auto max-w-[400px]">
              <div className="w-full">
                <TextInput
                  label="Username"
                  size="xl"
                  {...form.getInputProps("username")}
                />

                <Group noWrap spacing={0}>
                  <Autocomplete
                    disabled={usernameInvalid}
                    label="Room"
                    className={`${classes.buttonRight} my-6 w-full`}
                    size="xl"
                    limit={3}
                    {...form.getInputProps("room")}
                    data={form.values.room.length > 1 ? activeRooms : []}
                  />
                  <Button
                    disabled={usernameInvalid}
                    size="xl"
                    className={`${classes.buttonLeft} w-13 mt-11 px-4`}
                    type="submit"
                  >
                    <IconArrowBadgeRightFilled size={35} spacing={0} />
                  </Button>
                </Group>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
};

export default Home;
