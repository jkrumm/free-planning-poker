import React, { useEffect } from 'react';

import dynamic from 'next/dynamic';
import Link from 'next/link';

import { createServerSideHelpers } from '@trpc/react-query/server';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';

import {
  Button,
  Modal,
  RingProgress,
  SimpleGrid,
  Switch,
  Text,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import * as Sentry from '@sentry/nextjs';
import { IconEye } from '@tabler/icons-react';
import superjson from 'superjson';

import { logMsg } from 'fpp/constants/logging.constant';

import { api } from 'fpp/utils/api';

import { appRouter } from 'fpp/server/api/root';
import { createTRPCContext } from 'fpp/server/api/trpc';
import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import { AnalyticsCard } from 'fpp/components/analytics/analytics-card';
import { HistoricalTable } from 'fpp/components/analytics/historical-table';
import { LiveDataModel } from 'fpp/components/analytics/live-data-model';
import { ReoccurringChart } from 'fpp/components/analytics/reoccurring-chart';
import { StatsCard } from 'fpp/components/analytics/stats-card';
import { Hero } from 'fpp/components/layout/hero';
import Navbar from 'fpp/components/layout/navbar';
import { Meta } from 'fpp/components/meta';

const LoadingFrame = (props: { height: number }) => (
  <div
    style={{
      height: `${props.height}px`,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}
  >
    Loading...
  </div>
);

const HistoricalChart = dynamic(
  () => import('fpp/components/analytics/historical-chart'),
  {
    ssr: false,
    loading: () => <LoadingFrame height={685} />,
  },
);

const EstimationChart = dynamic(
  () => import('fpp/components/analytics/estimations-chart'),
  {
    ssr: false,
    loading: () => <LoadingFrame height={450} />,
  },
);

export const getStaticProps = async (context: CreateNextContextOptions) => {
  try {
    const helpers = createServerSideHelpers({
      router: appRouter,
      ctx: createTRPCContext(context),
      transformer: superjson,
    });

    // Fetch the data
    await Promise.all([
      helpers.analytics.getAnalytics.prefetch(),
      helpers.analytics.getServerAnalytics.prefetch(),
    ]);

    return {
      props: {
        trpcState: helpers.dehydrate(),
      },
      // Set revalidate to 1 hour (3600 seconds)
      revalidate: 3600,
      // If the data fetch fails, it will trigger a regeneration on the next request
      notFound: false,
    };
  } catch (error) {
    // Log the error but don't throw it
    console.error('Error in getStaticProps:', error);
    Sentry.captureException(error);

    return {
      // Return the last successful props but trigger a revalidation
      props: {},
      revalidate: 10, // Retry after 10 seconds if there's an error
    };
  }
};

// TODO: USE https://buildui.com/recipes/highlight when data fetching is done

const Analytics = () => {
  useTrackPageView(RouteType.ANALYTICS);
  const [lastUpdatedSeconds, setLastUpdatedSeconds] = React.useState(0);
  const [opened, { open, close }] = useDisclosure(false);

  const {
    data: analytics,
    dataUpdatedAt,
    refetch: refetchAnalytics,
  } = api.analytics.getAnalytics.useQuery(undefined, {
    refetchInterval: 10 * 1000, // 10 seconds
    retry: true,
  });

  const { data: serverAnalytics, refetch: refetchServerAnalytics } =
    api.analytics.getServerAnalytics.useQuery(undefined, {
      refetchInterval: 10 * 1000, // 10 seconds
      retry: true,
    });

  const refetch = () => {
    refetchAnalytics()
      .then(() => ({}))
      .catch(() => ({}));
    refetchServerAnalytics()
      .then(() => ({}))
      .catch(() => ({}));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdatedSeconds(Math.floor((Date.now() - dataUpdatedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  const [historicalTableOpen, setHistoricalTableOpen] = React.useState(true);
  const [reduceReoccurring, setReduceReoccurring] = React.useState(true);

  if (!analytics || !serverAnalytics) {
    Sentry.captureException(new Error(logMsg.SSG_FAILED));
    return <div>Loading...</div>;
  }

  const { behaviour, location_and_user_agent, traffic, votes } = analytics;

  const reoccurring = analytics.reoccurring.map((obj) => ({
    ...obj,
    date: new Date(obj.date),
  }));

  const historical = analytics.historical.map((obj) => ({
    ...obj,
    date: new Date(obj.date),
  }));

  return (
    <>
      <Meta title="Analytics" />
      <Navbar />
      <Hero />
      <Modal
        opened={opened}
        onClose={close}
        title="Live Data"
        centered
        size="auto"
      >
        <LiveDataModel serverAnalytics={serverAnalytics} />
      </Modal>
      <main className="flex flex-col items-center justify-center">
        <section className="container max-w-[800px] gap-12 px-4 mt-6 mb-8">
          <Text className="mb-4">
            Free Planning Poker aims to provide interested parties with{' '}
            <b>statistical insights into the Fibonacci-based Planning Poker</b>{' '}
            process. By examining the votes and averages of estimations (lowest,
            average, highest), users can gain valuable psychological insights
            into team dynamics and estimation behaviors, which can be
            interesting for those studying it or are interested in Agile
            methodologies.
          </Text>
          <Text className="mb-4">
            All collected analytical data is completely anonymized and GDPR
            compliant. We collect and store the data ourselves, and being open
            source, all relevant code is publicly accessible in our{' '}
            <a
              href="https://github.com/jkrumm/free-planning-poker/"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repository
            </a>
            . For more details, please visit our{' '}
            <Link href="/imprint">Privacy Policy</Link>.
          </Text>
        </section>
        <section className="container max-w-[1200px] gap-12 px-4 pb-28 pt-8">
          <div className="flex justify-between">
            <div className="flex flex-wrap">
              <h2>Live</h2>
              <IconEye className="ml-4 mt-[3px]" onClick={open} size={33} />
            </div>
            <Tooltip
              label={`Last update received ${lastUpdatedSeconds} seconds ago`}
            >
              <div className="flex flex-wrap">
                <RingProgress
                  className="mr-3 mt-[-3px]"
                  size={40}
                  thickness={6}
                  sections={[
                    {
                      value: (lastUpdatedSeconds / 10) * 100,
                      color: '#1971C2',
                    },
                  ]}
                />
                <Button onClick={refetch} className="mt-[-3px]">
                  Refresh
                </Button>
              </div>
            </Tooltip>
          </div>
          <SimpleGrid
            cols={{
              xs: 2,
              sm: 2,
              md: 2,
            }}
            spacing="md"
            className="pb-8"
          >
            <StatsCard name="Open Rooms" value={serverAnalytics.openRooms} />
            <StatsCard
              name="Conected Users"
              value={serverAnalytics.connectedUsers}
            />
          </SimpleGrid>
          <h2>Traffic</h2>
          <SimpleGrid
            cols={{
              xs: 2,
              sm: 2,
              md: 4,
            }}
            spacing="md"
            className="pb-8"
          >
            <StatsCard
              name="Unique users"
              value={historical[historical.length - 1]?.acc_new_users ?? 0}
            />
            <StatsCard
              name="Total page views"
              value={historical[historical.length - 1]?.acc_page_views ?? 0}
            />
            <StatsCard
              name="Duration"
              value={traffic.average_duration}
              valueAppend="minutes"
            />
            <StatsCard
              name="Bounce rate"
              value={traffic.bounce_rate * 100}
              valueAppend="%"
            />
          </SimpleGrid>
          <h2>Votes</h2>
          <SimpleGrid
            cols={{
              sm: 2,
              md: 4,
            }}
            spacing="md"
            className="pb-8"
          >
            <StatsCard
              name="Total votes"
              value={historical[historical.length - 1]?.acc_votes ?? 0}
            />
            <StatsCard
              name="Total estimations"
              value={historical[historical.length - 1]?.acc_estimations ?? 0}
            />
            <StatsCard
              name="Avg Estimations"
              value={votes.avg_estimations_per_vote}
            />
            <StatsCard
              name="Avg Spectators"
              value={votes.avg_spectators_per_vote}
            />
            <StatsCard
              name="Avg min estimation"
              value={votes.avg_min_estimation}
            />
            <StatsCard name="Avg estimation" value={votes.avg_estimation} />
            <StatsCard
              name="Avg max estimation"
              value={votes.avg_max_estimation}
            />
            <StatsCard
              name="Avg duration"
              value={votes.avg_duration_per_vote}
              valueAppend="minutes"
            />
          </SimpleGrid>
          <div className="pb-8">
            <EstimationChart
              data={votes.weekday_counts}
              title="Popularity on each Weekday"
              xAxisName="Weekday"
              yXisName="Vote Amount"
            />
          </div>
          <EstimationChart
            data={votes.estimation_counts}
            title="Popularity of each Estimation Fibonacci Number"
            xAxisName="Estimation Number"
            yXisName="Estimation Amount"
          />
          <div className="md:flex justify-between">
            <h2 className="pt-8">Reoccurring</h2>
            <Switch
              label="Reduce after 30days inactivity"
              className="mt-auto mb-[20px] cursor-pointer"
              checked={reduceReoccurring}
              onChange={() => setReduceReoccurring(!reduceReoccurring)}
            />
            <div className="mt-auto mb-[20px] flex justify-between">
              <div className="flex items-center mr-5">
                <div className="w-4 h-4 bg-[#1971C2] mr-2"></div>
                <span>Reoccurring Users</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-[#40C057] mr-2"></div>
                <span>Reoccurring Rooms</span>
              </div>
            </div>
          </div>
          <ReoccurringChart
            reoccurring={reoccurring}
            reduceReoccurring={reduceReoccurring}
          />
          <div className="flex justify-between">
            <h2 className="pt-8">Historical</h2>
            <Switch
              label="Show as Table"
              className="mt-auto mb-[20px] cursor-pointer"
              checked={historicalTableOpen}
              onChange={() => setHistoricalTableOpen(!historicalTableOpen)}
            />
          </div>
          <HistoricalTable
            historical={historical.reverse()}
            historicalTableOpen={historicalTableOpen}
          />
          <HistoricalChart historical={historical} />
          <h2 className="pt-8">Behaviour</h2>
          <SimpleGrid
            cols={{
              sm: 1,
              md: 3,
            }}
            spacing="md"
            className="pb-8"
          >
            <AnalyticsCard headline={'Events'} data={behaviour.routes} />
            <AnalyticsCard headline={'Join'} data={behaviour.events} />
            <AnalyticsCard headline={'Rooms'} data={behaviour.rooms} />
          </SimpleGrid>
          <h2>Location</h2>
          <SimpleGrid
            cols={{
              sm: 1,
              md: 3,
            }}
            spacing="md"
            className="pb-8"
          >
            <AnalyticsCard
              headline={'Countries'}
              data={location_and_user_agent.country}
            />
            <AnalyticsCard
              headline={'Regions'}
              data={location_and_user_agent.region}
            />
            <AnalyticsCard
              headline={'Cities'}
              data={location_and_user_agent.city}
            />
          </SimpleGrid>
          <h2>User Agent</h2>
          <SimpleGrid
            cols={{
              sm: 1,
              md: 4,
            }}
            spacing="md"
            className="pb-8"
          >
            <AnalyticsCard
              headline={'Operating Systems'}
              data={location_and_user_agent.os}
            />
            <AnalyticsCard
              headline={'Devices'}
              data={location_and_user_agent.device}
            />
            <AnalyticsCard
              headline={'Browsers'}
              data={location_and_user_agent.browser}
            />
            <AnalyticsCard headline={'Sources'} data={behaviour.sources} />
          </SimpleGrid>
        </section>
      </main>
    </>
  );
};

export default Analytics;
