import Head from "next/head";

import { api } from "fpp/utils/api";
import React, { useEffect, useState } from "react";
import { type NextPage } from "next";
import {
  Autocomplete,
  Button,
  createStyles,
  Group,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { Hero } from "fpp/components/hero";
import { useRouter } from "next/router";
import {
  IconArrowBadgeDownFilled,
  IconArrowBadgeRightFilled,
  IconArrowBadgeUpFilled,
} from "@tabler/icons-react";
import { useForm } from "@mantine/form";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import {
  useTrackPageView,
  type UseTrackPageViewMutation,
} from "fpp/utils/use-tracking.hooks";
import { EventType } from ".prisma/client";
import { generate } from "random-words";
import { RouteType } from "@prisma/client";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import PointsTable from "fpp/components/points-table";

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
  const trackPageViewMutation =
    api.tracking.trackPageView.useMutation() as UseTrackPageViewMutation;
  useTrackPageView(RouteType.HOME, visitorId, trackPageViewMutation);
  const sendEvent = api.tracking.trackEvent.useMutation();

  const recentRoom = useLocalstorageStore((state) => state.recentRoom);
  const [hasRecentRoom, setHasRecentRoom] = useState(false);
  useEffect(() => {
    if (recentRoom) {
      setHasRecentRoom(true);
    }
  }, [recentRoom]);

  const activeRooms = api.room.getActiveRooms.useQuery().data ?? [];

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
      room: generate({ minLength: 3, exactly: 1 })[0] ?? "",
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

  const randomRoomQuery = api.room.getRandomRoom.useQuery();
  useEffect(() => {
    if (randomRoomQuery.data) {
      form.setFieldValue("room", randomRoomQuery.data);
    }
  }, [randomRoomQuery.data]);

  const [usernameInvalid, setUsernameInvalid] = useState<boolean>(false);

  useEffect(() => {
    setUsernameInvalid(
      !form.values.username ||
        form.values.username.replace(/[^A-Za-z]/g, "").length < 3
    );
  }, [form.values.username]);

  const { ref, inView } = useInView({
    rootMargin: "-300px",
    triggerOnce: false,
  });

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
      <Hero />
      <main className="flex flex-col items-center justify-center">
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
                sendEvent.mutate({
                  visitorId,
                  type: EventType.ENTER_RECENT_ROOM,
                });
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
                sendEvent.mutate({
                  visitorId,
                  type: EventType.ENTER_EXISTING_ROOM,
                });
              } else if (roomName === randomRoomQuery.data) {
                sendEvent.mutate({
                  visitorId,
                  type: EventType.ENTER_RANDOM_ROOM,
                });
              } else {
                sendEvent.mutate({
                  visitorId,
                  type: EventType.ENTER_NEW_ROOM,
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
        <Link
          href="/#master-the-art-of-planning-poker"
          className={`fixed-article-link ${inView ? "hidden" : ""}`}
        >
          <Button
            rightIcon={<IconArrowBadgeDownFilled size={35} spacing={0} />}
            size="lg"
            color="gray"
          >
            Understand Planning Poker{" "}
          </Button>
        </Link>
        <Link href="/" className={`scroll-to-top ${!inView ? "hidden" : ""}`}>
          <Button size="lg" color="gray" px={8}>
            <IconArrowBadgeUpFilled size={35} spacing={0} />
          </Button>
        </Link>
        <div className="w-full max-w-[1200px] px-4 pb-16">
          <article id="master-the-art-of-planning-poker" ref={ref}>
            <header>
              <Title order={1} className="pt-[60px] text-center">
                Master the Art of Planning Poker: An Agile Approach to
                Estimation
              </Title>
            </header>

            <section className="mx-auto block max-w-[700px] text-justify">
              <Title order={2}>The Essence of Planning Poker</Title>

              <Text component="p">
                At the core of Agile methodologies such as{" "}
                <b>Scrum, Kanban, and Jira</b> lies the principle of iterative
                development and efficient task estimation. One of the most
                popular estimation techniques used across these methods is{" "}
                <b>Planning Poker</b>, which combines collective intelligence,
                game theory, and the Fibonacci sequence to provide accurate and
                reasonable workload estimations.
              </Text>

              <Title order={2}>How It Works: The Fibonacci Flavor</Title>

              <Text component="p">
                In Planning Poker, every task is assigned a Fibonacci number (1,
                2, 3, 5, 8, 13, 21, 34) based on its estimated complexity and
                time requirement. The <b>Fibonacci sequence</b>, known for its
                exponential growth, mirrors the uncertainty and risk associated
                with task estimation, helping to reflect the increasingly larger
                efforts required for complex tasks. It essentially transforms
                the abstract task complexity into a concrete numerical score,
                which is used to rationalize and prioritize the project backlog.
              </Text>

              <Title order={2}>The Power of Anonymity and Gamification</Title>

              <Text component="p">
                Every member of the Agile team casts their vote anonymously in
                Planning Poker, preventing influence and promoting diversity in
                thought. The concept of <b>gamification</b> is also integrated
                into the process, where voting is akin to playing a game,
                thereby increasing engagement and ensuring an unbiased and
                accurate estimation of tasks.
              </Text>

              <Title order={2}>
                Interpreting Estimations and Splitting Tickets
              </Title>

              <Text component="p">
                Upon revealing the votes, the highest and the lowest estimators
                elaborate on their reasoning, providing useful insight into
                different perspectives on task complexity. If a task garners a
                high estimation, such as 13 story points or above, it’s
                typically split into smaller, more manageable tasks. This
                prevents the overloading of the sprint and provides better
                visibility into individual task elements.
              </Text>

              <Title order={2}>
                Statistical Insights: The Value of Voting Metrics
              </Title>

              <Text component="p">
                Key statistical metrics generated from the Planning Poker voting
                process, including min, max, avg, and count of votes hold
                significant value. The average vote tends to lean closer towards
                the maximum vote, hinting at the inherent inclination of teams
                to be conservative in their estimations. This tendency to be
                slightly pessimistic helps teams to cushion themselves against
                unforeseen complexities or delays, ensuring the successful and
                timely completion of sprints.
              </Text>
            </section>

            <section className="my-[80px]">
              <Title order={2} className="mb-[30px]">
                Fibonacci Sequence for Task Estimation: A Quick Guide
              </Title>

              <PointsTable />
            </section>

            <footer className="mx-auto my-[60px] max-w-[700px] text-center">
              <Text component="p" size="lg">
                Embrace the power of collective intelligence, gamification, and
                the Fibonacci sequence with Planning Poker and set your Agile
                project management on the path to success.
              </Text>
            </footer>
          </article>
        </div>
      </main>
    </>
  );
};

export default Home;
