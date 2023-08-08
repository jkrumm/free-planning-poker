import { api } from "fpp/utils/api";
import React from "react";
import { type NextPage } from "next";
import { Button, Text, Title } from "@mantine/core";
import { Hero } from "fpp/components/layout/hero";
import {
  IconArrowBadgeDownFilled,
  IconArrowBadgeUpFilled,
} from "@tabler/icons-react";
import Link from "next/link";
import PointsTable from "fpp/components/index/points-table";
import dynamic from "next/dynamic";
import IndexFormPlaceholder from "fpp/components/index/form-placeholder";
import { useInView } from "react-intersection-observer";
import {
  type TrackPageViewMutation,
  useTrackPageView,
} from "fpp/utils/use-tracking.hooks";
import { RouteType } from "@prisma/client";
import { Meta } from "fpp/components/meta";

const IndexFormWithNoSSR = dynamic<{
  randomRoom: string | undefined;
  activeRooms: string[];
}>(() => import("../components/index/form"), {
  ssr: false,
  loading: () => <IndexFormPlaceholder />,
});

const Home: NextPage = () => {
  const trackPageViewMutation = api.tracking.trackPageView.useMutation()
    .mutate as TrackPageViewMutation;
  useTrackPageView(RouteType.HOME, trackPageViewMutation);

  const activeRooms = api.room.getActiveRooms.useQuery().data ?? [];
  const randomRoom = api.room.getRandomRoom.useQuery().data;

  const { ref, inView } = useInView({
    rootMargin: "-300px",
    triggerOnce: false,
  });

  return (
    <>
      <Meta />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        {/* <IndexForm randomRoom={randomRoom} activeRooms={activeRooms} /> */}
        <IndexFormWithNoSSR randomRoom={randomRoom} activeRooms={activeRooms} />
        <Link
          href="/#master-the-art-of-planning-poker"
          className={`fixed-article-link hidden lg:block ${
            inView ? "hide" : ""
          }`}
        >
          <Button
            rightIcon={<IconArrowBadgeDownFilled size={35} spacing={0} />}
            size="lg"
            color="gray"
            role="understand-planning-poker"
          >
            Understand Planning Poker{" "}
          </Button>
        </Link>
        <Link href="/" className={`scroll-to-top ${!inView ? "hide" : ""}`}>
          <Button size="lg" color="gray" px={8} role="scroll-to-top">
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
                2, 3, 5, 8, 13, 21) based on its estimated complexity and time
                requirement. The <b>Fibonacci sequence</b>, known for its
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
