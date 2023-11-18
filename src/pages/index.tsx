import React, { lazy, Suspense } from "react";
import { type NextPage } from "next";
import { Alert, Group, Text, Title } from "@mantine/core";
import PointsTable from "fpp/components/index/points-table";
import { useTrackPageView } from "fpp/hooks/use-tracking.hook";
import { Meta } from "fpp/components/meta";
import { useLogger } from "next-axiom";
// import IndexForm from "fpp/components/index/form";
import { IconAlertCircle } from "@tabler/icons-react";
import { RouteType } from "fpp/server/db/schema";
import IndexFormSkeleton from "fpp/components/index/form-skeleton";
import Image from "next/image";
import Link from "next/link";

const IndexForm = lazy(() => import("fpp/components/index/form"));

// const ScrollButtonsWithNoSSR = dynamic<{
//   inView: boolean;
// }>(() => import("../components/index/scroll-buttons"), {
//   ssr: false,
// });

const Home: NextPage = () => {
  const logger = useLogger().with({ route: RouteType.HOME });
  useTrackPageView(RouteType.HOME, logger);

  // const { ref, inView } = useInView({
  //   rootMargin: "-300px",
  //   triggerOnce: false,
  // });

  return (
    <div className="homepage">
      <Meta />
      <Link href="/" className="block pt-12 no-underline">
        <div className="logo" />
        <h1
          className={`center m-0 block p-0 text-center text-[42px] font-bold md:text-[62px]`}
        >
          <Text
            component="span"
            variant="gradient"
            gradient={{ from: "#228BE6", to: "#228BE6", deg: 100 }}
            inherit
          >
            Free-Planning-Poker.com
          </Text>
        </h1>
      </Link>
      {/* <Navbar /> */}
      <main className="mt-10 flex flex-col items-center justify-center p-6">
        <div className="gradients"></div>
        <div className="mb-20 text-center">
          <Title order={2}>Estimate your story points faster than ever</Title>
          <Title order={3} className="mt-5 font-normal opacity-70">
            Say goodbye to complicated planning poker tools and estimate in
            seconds with this user-friendly app.
            <br />
            Open source and privacy focused.
          </Title>
        </div>
        <Group className="mb-20">
          <IndexFormSkeleton />
        </Group>
        <div className="gradient-image"></div>
        <div className="z-10 w-[1432px] max-w-full p-6">
          <Image
            src="/fpp_screenshot.png"
            width={2852 / 2}
            height={1586 / 2}
            className="h-auto max-w-full rounded-lg border-4 border-solid border-[#2C2E33]"
            alt="Picture of the free planning poker app ui"
          />
        </div>
        <div className="hidden md:block">
          <Suspense fallback={<IndexFormSkeleton />}>
            <IndexForm logger={logger} />
          </Suspense>
        </div>
        <div className="mx-8 md:hidden">
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
          </Alert>
        </div>
        {/*<ScrollButtonsWithNoSSR inView={inView} />*/}
        <div className="w-full max-w-[1200px] px-4 pb-16">
          {/*<article id="master-the-art-of-planning-poker" ref={ref}>*/}
          <article id="master-the-art-of-planning-poker">
            <header>
              <Title order={2} className="pt-[60px] text-center">
                Master the Art of Planning Poker: An Agile Approach to
                Estimation
              </Title>
            </header>

            <section className="mx-auto block max-w-[700px] text-justify">
              <Title order={3}>The Essence of Planning Poker</Title>

              <Text component="p">
                At the core of Agile methodologies such as{" "}
                <b>Scrum, Kanban, and Jira</b> lies the principle of iterative
                development and efficient task estimation. One of the most
                popular estimation techniques used across these methods is{" "}
                <b>Planning Poker</b>, which combines collective intelligence,
                game theory, and the Fibonacci sequence to provide accurate and
                reasonable workload estimations.
              </Text>

              <Title order={4}>How It Works: The Fibonacci Flavor</Title>

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

              <Title order={3}>The Power of Anonymity and Gamification</Title>

              <Text component="p">
                Every member of the Agile team casts their vote anonymously in
                Planning Poker, preventing influence and promoting diversity in
                thought. The concept of <b>gamification</b> is also integrated
                into the process, where voting is akin to playing a game,
                thereby increasing engagement and ensuring an unbiased and
                accurate estimation of tasks.
              </Text>

              <Title order={3}>
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

              <Title order={3}>
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
              <Title order={3} className="mb-[30px]">
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
    </div>
  );
};

export default Home;
