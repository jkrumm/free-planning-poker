import React from "react";
import { api } from "fpp/utils/api";
import {
  type TrackPageViewMutation,
  useTrackPageView,
} from "fpp/utils/use-tracking.hooks";
import { Card, Group, SimpleGrid, Text, Title } from "@mantine/core";
import { RouteType } from "@prisma/client";
import { createServerSideHelpers } from "@trpc/react-query/server";
import { appRouter } from "fpp/server/api/root";
import { createTRPCContext } from "fpp/server/api/trpc";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import { log } from "fpp/utils/console-log";
import { Meta } from "fpp/components/meta";
import { Hero } from "fpp/components/layout/hero";
import { PageViewChart } from "fpp/components/charts/page-view-chart";
import { type CountResult } from "fpp/server/api/routers/tracking";

export const getStaticProps = async (context: CreateNextContextOptions) => {
  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createTRPCContext(context),
  });

  await helpers.tracking.getPageViews.prefetch();
  await helpers.vote.getVotes.prefetch();
  await helpers.tracking.getAggregatedVisitorInfo.prefetch();

  return {
    props: { trpcState: helpers.dehydrate({ dehydrateQueries: true }) },
    revalidate: 3600,
  };
};

// const Analytics = (props: InferGetStaticPropsType<typeof getStaticProps>) => {
const Analytics = () => {
  const trackPageViewMutation = api.tracking.trackPageView.useMutation()
    .mutate as TrackPageViewMutation;
  useTrackPageView(RouteType.ANALYTICS, trackPageViewMutation);

  const { data: pageViews, isFetched: isPageViewsFetched } =
    api.tracking.getPageViews.useQuery(undefined, {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    });
  const { data: votes, isFetched: isVotesFetched } = api.vote.getVotes.useQuery(
    undefined,
    {
      staleTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    }
  );
  const {
    data: aggregatedVisitorInfo,
    isFetched: isAggregatedVisitorInfoFetched,
  } = api.tracking.getAggregatedVisitorInfo.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  if (
    !isPageViewsFetched ||
    !isVotesFetched ||
    !isAggregatedVisitorInfoFetched
  ) {
    // TODO: sentry
    return <div>Loading...</div>;
  }

  log("pageViews", pageViews ?? {});
  log("votes", votes ?? {});
  log("getAggregatedVisitorInfo", aggregatedVisitorInfo ?? {});

  return (
    <>
      <Meta title="Analytics" />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container max-w-[1200px] gap-12 px-4 pb-28 pt-8">
          {pageViews && votes && aggregatedVisitorInfo && (
            <>
              <h1>Site Traffic</h1>
              <SimpleGrid
                cols={6}
                spacing="md"
                breakpoints={[
                  { maxWidth: "md", cols: 3 },
                  { maxWidth: "xs", cols: 2 },
                ]}
                className="pb-8"
              >
                <StatsCard
                  name="Total page views"
                  value={pageViews.stats.total}
                />
                <StatsCard
                  name="Unique visitors"
                  value={pageViews.stats.unique}
                />
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
                  tooltip="Unique visitors who have voted"
                />
              </SimpleGrid>
              <h1>Vote analytics</h1>
              <SimpleGrid
                cols={4}
                spacing="md"
                breakpoints={[{ maxWidth: "md", cols: 2 }]}
                className="pb-8"
              >
                <StatsCard name="Total votes" value={votes.totalVotes} />
                <StatsCard name="Votes per day" value={votes.votesPerDay} />
                <StatsCard
                  name="Votes per visitor"
                  value={votes.votesPerVisitor}
                />
                <StatsCard
                  name="Avg amount of estimations"
                  value={votes.amountOfVotes}
                />
                <StatsCard
                  name="Avg amount of spectators"
                  value={votes.amountOfSpectators}
                />
                <StatsCard
                  name="Avg lowest estimation"
                  value={votes.lowestVoteAvg}
                />
                <StatsCard name="Avg estimation" value={votes.voteAvg} />
                <StatsCard
                  name="Avg highest estimation"
                  value={votes.highestVoteAvg}
                />
              </SimpleGrid>
              <h1>Historical data</h1>
              <PageViewChart pageViews={pageViews} />
              <h1 className="mb-2 mt-[60px]">Location data</h1>
              <SimpleGrid
                cols={3}
                spacing="md"
                breakpoints={[{ maxWidth: "md", cols: 1 }]}
              >
                <AnalyticsCard
                  headline={"Countries"}
                  data={aggregatedVisitorInfo.countryCounts}
                />
                <AnalyticsCard
                  headline={"Regions"}
                  data={aggregatedVisitorInfo.regionCounts}
                />
                <AnalyticsCard
                  headline={"Cities"}
                  data={aggregatedVisitorInfo.cityCounts}
                />
              </SimpleGrid>
              <h1 className="mb-2 mt-[60px]">User Agent data</h1>
              <SimpleGrid
                cols={3}
                spacing="md"
                breakpoints={[{ maxWidth: "md", cols: 1 }]}
              >
                <AnalyticsCard
                  headline={"Operating Systems"}
                  data={aggregatedVisitorInfo.osCounts}
                />
                <AnalyticsCard
                  headline={"Devices"}
                  data={aggregatedVisitorInfo.deviceCounts}
                />
                <AnalyticsCard
                  headline={"Browsers"}
                  data={aggregatedVisitorInfo.browserCounts}
                />
              </SimpleGrid>
            </>
          )}
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
        <Title order={4}>{headline}</Title>
      </Card.Section>
      <Card.Section className="px-2">
        {sortedData.map((item, index) => (
          <Group position="apart" key={index} className="relative py-2">
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
  tooltip,
}: {
  name: string;
  value: number;
  valueAppend?: string;
  tooltip?: string;
}) => {
  const InnerCard = (
    <Card withBorder radius="md" padding="md">
      <Text fz="xs" tt="uppercase" fw={700} c="dimmed">
        {name}
      </Text>
      <Text fz="lg" fw={500}>
        {value} {valueAppend}
      </Text>
    </Card>
  );

  return InnerCard;

  // TODO: make Tooltip SSR compatible
  /* return tooltip ? (
    <Tooltip label={tooltip} color="gray" position="bottom" withArrow>
      {InnerCard}
    </Tooltip>
  ) : (
    InnerCard
  ); */
};

export default Analytics;
