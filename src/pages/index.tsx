import React, { Suspense, lazy } from 'react';

import { type NextPage } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { Alert, Button, Text, Title } from '@mantine/core';

import { IconAlertCircle } from '@tabler/icons-react';

import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import IndexFormSkeleton from 'fpp/components/index/form-skeleton';
import PointsTable from 'fpp/components/index/points-table';
import { Hero } from 'fpp/components/layout/hero';
import { Meta } from 'fpp/components/meta';

const IndexForm = lazy(() => import('fpp/components/index/form'));

const Home: NextPage = () => {
  useTrackPageView(RouteType.HOME);

  return (
    <div className="homepage">
      <Meta />
      <Hero />
      <main className="flex flex-col items-center justify-center p-6">
        <div className="gradients"></div>
        <div className="mb-20 text-center">
          <Title order={2}>Estimate your Story Points Faster than ever</Title>
          <Title order={3} className="mt-5 font-normal opacity-70">
            Say goodbye to complicated planning poker tools and estimate in
            seconds with this user-friendly app.
            <br />
            No signups, open source and privacy focused.
          </Title>
        </div>
        <Suspense fallback={<IndexFormSkeleton />}>
          <IndexForm />
        </Suspense>
        <div className="mx-8 mb-10 md:hidden">
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
        <div className="gradient-image"></div>
        <div className="z-10 w-[1432px] max-w-full p-6">
          <section id="screenshot">
            <Image
              src="/images/fpp_screenshot.png"
              width={2852 / 2}
              height={1586 / 2}
              className="h-auto max-w-full rounded-lg border-4 border-solid border-[#2C2E33]"
              alt="Picture of the free planning poker app ui"
              placeholder="blur"
              blurDataURL={'/fpp_screenshot.png'}
              priority={true}
            />
          </section>
        </div>
        <div className="mt-20 w-full max-w-[1050px] px-4 pb-16">
          <section id="features" className="mb-20">
            <Title order={2} className="text-center">
              Powerful Yet Simple
            </Title>
            <Title
              order={3}
              className="mt-5 font-normal text-center opacity-70"
            >
              Essential Features for Effective Sprint Planning
            </Title>
            <div className="feature-grid md:grid grid-cols-10 mt-12 grid-rows-6 gap-10">
              <div className="col-span-6 row-span-3 mb-8 md:mb-0">
                <div className="bg-[#242424] w-full rounded-t-md p-2">
                  <Image
                    src="/images/fpp_control.png"
                    width={699 * 0.8}
                    height={122 * 0.8}
                    className="h-auto w-full rounded-t-md"
                    alt="Picture of the controls in the planning poker app"
                    placeholder="blur"
                    blurDataURL={'/images/fpp_control.png'}
                    priority={false}
                  />
                </div>
                <div className="p-3">
                  <p>
                    <strong>Share Room URL</strong> - Click the room name to
                    copy the URL.
                  </p>
                  <p>
                    <strong>Room Reset</strong> - Reset all votes with a single
                    tap.
                  </p>
                  <p>
                    <strong>Spectator Mode</strong> - For those who are not
                    involved in estimations.
                  </p>
                  <p>
                    <strong>Auto Show</strong> - Automatically reveal
                    estimations once everyone has voted.
                  </p>
                </div>
              </div>
              <div className="col-span-4 row-span-7 col-start-7 mb-8 md:mb-0">
                <div className="bg-[#242424] w-full rounded-t-md p-2">
                  <Image
                    src="/images/fpp_room_stats.png"
                    width={390 * 0.8}
                    height={590 * 0.8}
                    className="h-auto max-w-full mx-auto md:ml-auto block rounded-t-md"
                    alt="Picture of the room stats in the planning poker app"
                    placeholder="blur"
                    blurDataURL={'/images/fpp_room_stats.png'}
                    priority={false}
                  />
                </div>
                <div className="p-3">
                  <p>
                    <strong>Voting analytics</strong> - Gain insights into
                    participation, efficiency, and trends in your voting
                    sessions. To improve your sprint planning in the future.
                  </p>
                </div>
              </div>
              <div className="col-span-3 row-span-4 row-start-4 mb-8 md:mb-0">
                <div className="bg-[#242424] w-full rounded-t-md p-2">
                  <Image
                    src="/images/fpp_user_settings.png"
                    width={390 * 0.8}
                    height={590 * 0.8}
                    className="h-auto max-w-full mx-auto block rounded-t-md"
                    alt="Picture of the room stats in the planning poker app"
                    placeholder="blur"
                    blurDataURL={'/images/fpp_user_settings.png'}
                    priority={false}
                  />
                </div>
                <div className="p-3">
                  <p>
                    <strong>User Settings</strong> Change your username and
                    toggle sounds and popup notifications.
                  </p>
                </div>
              </div>
              <div className="col-span-3 row-span-4 col-start-4 row-start-4">
                <div className="roadmap" />
                <div className="p-3">
                  <p>
                    <strong>Roadmap</strong> - There is much more to come!
                  </p>
                  <Link href="/roadmap">
                    <Button variant="default" fullWidth className="mt-4">
                      Go to Roadmap
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </section>
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
                At the core of Agile methodologies such as{' '}
                <b>Scrum, Kanban, and Jira</b> lies the principle of iterative
                development and efficient task estimation. One of the most
                popular estimation techniques used across these methods is{' '}
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
