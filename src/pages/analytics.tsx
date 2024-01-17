import React from 'react';

import { createServerSideHelpers } from '@trpc/react-query/server';
import { type FetchCreateContextFnOptions } from '@trpc/server/dist/adapters/fetch';

import { Card, Group, SimpleGrid, Text, Title } from '@mantine/core';

import * as Sentry from '@sentry/nextjs';
import { useLogger } from 'next-axiom';
import superjson from 'superjson';

import { logMsg } from 'fpp/constants/logging.constant';

import { api } from 'fpp/utils/api';

import { appRouter } from 'fpp/server/api/root';
import { type CountResult } from 'fpp/server/api/routers/tracking.router';
import { createTRPCContext } from 'fpp/server/api/trpc';
import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import { PageViewChart } from 'fpp/components/charts/page-view-chart';
import { Hero } from 'fpp/components/layout/hero';
import { Meta } from 'fpp/components/meta';

export const getStaticProps = async (context: FetchCreateContextFnOptions) => {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createTRPCContext(context),
    transformer: superjson,
  });

  await helpers.tracking.getPageViews.prefetch();
  await helpers.vote.getVotes.prefetch();
  await helpers.tracking.getAggregatedVisitorInfo.prefetch();

  return {
    props: { trpcState: helpers.dehydrate() },
    revalidate: 3600,
  };
};

const Analytics = () => {
  const logger = useLogger().with({ route: RouteType.ANALYTICS });
  useTrackPageView(RouteType.ANALYTICS, logger);

  const { data: pageViews } = api.tracking.getPageViews.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { data: votes } = api.vote.getVotes.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { data: aggregatedVisitorInfo } =
    api.tracking.getAggregatedVisitorInfo.useQuery(undefined, {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: false,
    });

  if (!pageViews || !votes || !aggregatedVisitorInfo) {
    logger.error(logMsg.SSG_FAILED);
    Sentry.captureException(new Error(logMsg.SSG_FAILED));
    return <div>Loading...</div>;
  }

  return (
    <>
      <Meta title="Analytics" />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container max-w-[1200px] gap-12 px-4 pb-28 pt-8">
          <h1>Site Traffic</h1>
          <SimpleGrid
            cols={{
              xs: 2,
              sm: 3,
              md: 6,
            }}
            spacing="md"
            className="pb-8"
          >
            <StatsCard name="Total page views" value={pageViews.stats.total} />
            <StatsCard name="Unique visitors" value={pageViews.stats.unique} />
            <StatsCard
              name="Page views per day"
              value={pageViews.stats.avgPerDay}
            />
            <StatsCard
              name="Views per visitor"
              value={pageViews.stats.viewsPerVisit}
            />
            <StatsCard name="Duration" value={pageViews.stats.duration} />
            <StatsCard
              name="Bounce rate"
              value={pageViews.stats.bounceRate}
              valueAppend="%"
              // tooltip="Unique visitors who have voted"
            />
          </SimpleGrid>
          <h1>Vote analytics</h1>
          <SimpleGrid
            cols={{
              sm: 2,
              md: 4,
            }}
            spacing="md"
            className="pb-8"
          >
            <StatsCard name="Total votes" value={votes.totalVotes} />
            <StatsCard name="Votes per day" value={votes.votesPerDay} />
            <StatsCard name="Votes per visitor" value={votes.votesPerVisitor} />
            <StatsCard
              name="Avg amount of estimations"
              value={votes.avgAmountOfEstimations}
            />
            <StatsCard
              name="Avg amount of spectators"
              value={votes.avgAmountOfSpectators}
            />
            <StatsCard
              name="Avg lowest estimation"
              value={votes.avgMinEstimation}
            />
            <StatsCard name="Avg estimation" value={votes.avgAvgEstimation} />
            <StatsCard
              name="Avg highest estimation"
              value={votes.avgMaxEstimation}
            />
          </SimpleGrid>
          <h1>Historical data</h1>
          <PageViewChart pageViews={pageViews} />
          <h1 className="mb-2 mt-[60px]">Location data</h1>
          <SimpleGrid
            cols={{
              sm: 1,
              md: 3,
            }}
            spacing="md"
          >
            <AnalyticsCard
              headline={'Countries'}
              data={aggregatedVisitorInfo.countryCounts}
            />
            <AnalyticsCard
              headline={'Regions'}
              data={aggregatedVisitorInfo.regionCounts}
            />
            <AnalyticsCard
              headline={'Cities'}
              data={aggregatedVisitorInfo.cityCounts}
            />
          </SimpleGrid>
          <h1 className="mb-2 mt-[60px]">User Agent data</h1>
          <SimpleGrid
            cols={{
              sm: 1,
              md: 3,
            }}
            spacing="md"
          >
            <AnalyticsCard
              headline={'Operating Systems'}
              data={aggregatedVisitorInfo.osCounts}
            />
            <AnalyticsCard
              headline={'Devices'}
              data={aggregatedVisitorInfo.deviceCounts}
            />
            <AnalyticsCard
              headline={'Browsers'}
              data={aggregatedVisitorInfo.browserCounts}
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
  data: CountResult;
  headline: string;
}) => {
  const sortedData = data.sort((a, b) => b.value - a.value);
  const highestValue = sortedData[0]?.value ?? 0;

  return (
    <Card withBorder shadow="sm" radius="md">
      <Card.Section withBorder inheritPadding py="xs">
        <Title order={2} size="md">
          {headline}
        </Title>
      </Card.Section>
      <Card.Section className="px-2">
        {sortedData.map((item, index) => (
          <Group key={index} className="relative py-2">
            <div
              className="absolute h-[40px] w-full rounded bg-[#2C2E33]"
              style={{ width: `${(item.value / highestValue) * 100}%` }}
            />
            <Text fz="md" className="z-10 m-2">
              {item.name}
            </Text>
            <Text fz="md" className="z-10 m-2">
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
