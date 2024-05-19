import React from 'react';

import { createServerSideHelpers } from '@trpc/react-query/server';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';

import { Card, Group, SimpleGrid, Text, Title } from '@mantine/core';

import * as Sentry from '@sentry/nextjs';
import superjson from 'superjson';

import { logMsg } from 'fpp/constants/logging.constant';

import { api } from 'fpp/utils/api';

import { appRouter } from 'fpp/server/api/root';
import { createTRPCContext } from 'fpp/server/api/trpc';
import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import { HistoricalChart } from 'fpp/components/analytics/historical-chart';
import { Hero } from 'fpp/components/layout/hero';
import Navbar from 'fpp/components/layout/navbar';
import { Meta } from 'fpp/components/meta';

export const getStaticProps = async (context: CreateNextContextOptions) => {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createTRPCContext(context),
    transformer: superjson,
  });

  await helpers.analytics.getAnalytics.prefetch();

  return {
    props: { trpcState: helpers.dehydrate() },
    revalidate: 3600,
  };
};

const Analytics = () => {
  useTrackPageView(RouteType.ANALYTICS);

  const { data: analytics } = api.analytics.getAnalytics.useQuery();

  if (!analytics) {
    Sentry.captureException(new Error(logMsg.SSG_FAILED));
    return <div>Loading...</div>;
  }

  const { behaviour, location_and_user_agent, traffic, votes } = analytics;

  const historical = analytics.historical.map((obj) => ({
    ...obj,
    date: new Date(obj.date),
  }));

  return (
    <>
      <Meta title="Analytics" />
      <Navbar />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container max-w-[1200px] gap-12 px-4 pb-28 pt-8">
          <h1>Traffic</h1>
          <SimpleGrid
            cols={{
              xs: 2,
              sm: 2,
              md: 4,
            }}
            spacing="md"
            className="pb-8"
          >
            <StatsCard name="Unique users" value={traffic.unique_users} />
            <StatsCard name="Total page views" value={traffic.page_views} />
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
          <h1>Votes</h1>
          <SimpleGrid
            cols={{
              sm: 2,
              md: 4,
            }}
            spacing="md"
            className="pb-8"
          >
            <StatsCard name="Total votes" value={votes.total_votes} />
            <StatsCard
              name="Total estimations"
              value={votes.total_estimations}
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
          <h1>Historical</h1>
          {/*<HistoricalChart historical={historical} />*/}
          <HistoricalChart historical={historical} />
          <h1 className="pt-8">Behaviour</h1>
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
          <h1>Location</h1>
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
          <h1>User Agent</h1>
          <SimpleGrid
            cols={{
              sm: 1,
              md: 3,
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
          </SimpleGrid>
        </div>
      </main>
    </>
  );
};

export const AnalyticsCard = ({
  data,
  headline,
}: {
  data: Record<string, number>;
  headline: string;
}) => {
  const sortedData = Object.entries(data)
    .sort((a, b) => b[1] - a[1]) // Sort by value in descending order
    .slice(0, 30) // Get the first 30 entries
    .map(([name, value]) => ({ name, value })); // Map to objects with name and value

  const highestValue = sortedData[0]?.value ?? 0; // Get the highest value

  return (
    <Card withBorder shadow="sm" radius="md">
      <Card.Section withBorder inheritPadding py="xs">
        <Title order={2} size="md">
          {headline}
        </Title>
      </Card.Section>
      <Card.Section className="px-2 overflow-y-scroll max-h-[400px] scrollbar-hide">
        {sortedData.map((item, index) => (
          <Group key={index} className="relative py-2">
            <div
              className="absolute h-[40px] w-full rounded bg-[#242424]"
              style={{ width: `${(item.value / highestValue) * 100}%` }}
            />
            <Text fz="md" className="z-10 m-2">
              {item.name}
            </Text>
            <Text fz="md" className="z-10 m-2 ml-auto">
              {item.value}
            </Text>
          </Group>
        ))}
      </Card.Section>
    </Card>
  );
};

export const StatsCard = ({
  name,
  value,
  valueAppend,
}: {
  name: string;
  value: number;
  valueAppend?: string;
}) => {
  return (
    <Card withBorder radius="md" padding="md">
      <Text fz="xs" tt="uppercase" fw={700} c="dimmed">
        {name}
      </Text>
      <Text fz="lg" fw={500}>
        {value} {valueAppend}
      </Text>
    </Card>
  );
};

export default Analytics;
