import React from "react";
import { api } from "fpp/utils/api";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import {
  useTrackPageView,
  type UseTrackPageViewMutation,
} from "fpp/utils/use-tracking.hooks";
import { Card, SimpleGrid, Text } from "@mantine/core";
import { RouteType } from "@prisma/client";
import { createServerSideHelpers } from "@trpc/react-query/server";
import { appRouter } from "fpp/server/api/root";
import superjson from "superjson";
import { createTRPCContext } from "fpp/server/api/trpc";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import { log } from "fpp/utils/console-log";
import {
  AggregatedVisitorInfo,
  PageViews,
} from "fpp/server/api/routers/tracking";
import { Votes } from "fpp/server/api/routers/vote";
import { Meta } from "fpp/components/meta";
import { Hero } from "fpp/components/layout/hero";
import { PageViewChart } from "fpp/components/charts/page-view-chart";
import { BarChart } from "fpp/components/charts/bar-chart";

export const getStaticProps = async (context: CreateNextContextOptions) => {
  /*const pageViews = api.tracking.getPageViews.useQuery().data;
  const votes = api.vote.getVotes.useQuery().data;
  const aggregatedVisitorInfo =
    api.tracking.getAggregatedVisitorInfo.useQuery().data;*/

  const helpers = createServerSideHelpers({
    router: appRouter,
    ctx: createTRPCContext(context),
    transformer: superjson, // optional - adds superjson serialization
  });
  // const id = context.params?.id as string;
  // prefetch `post.byId`

  await helpers.tracking.getPageViews.prefetch();
  await helpers.vote.getVotes.prefetch();
  await helpers.tracking.getAggregatedVisitorInfo.prefetch();

  return {
    props: { trpcState: helpers.dehydrate() },
    revalidate: 3600,
  };
};

const Analytics: React.FC<{
  trpcState: {
    json:
      | {
          queries: [
            {
              state: {
                data: PageViews;
              };
            },
            {
              state: {
                data: Votes;
              };
            },
            {
              state: {
                data: AggregatedVisitorInfo;
              };
            }
          ];
        }
      | undefined;
  };
}> = ({ trpcState }) => {
  console.log("trpcStae", trpcState.json?.queries);

  const pageViews = trpcState.json?.queries[0].state.data;
  const votes = trpcState.json?.queries[1].state.data;
  const aggregatedVisitorInfo = trpcState.json?.queries[2].state.data;

  log("pageViews", pageViews ?? {});
  log("votes", votes ?? {});
  log("getAggregatedVisitorInfo", aggregatedVisitorInfo ?? {});

  // const Analytics: NextPage = () => {
  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const trackPageViewMutation =
    api.tracking.trackPageView.useMutation() as UseTrackPageViewMutation;
  useTrackPageView(RouteType.ANALYTICS, visitorId, trackPageViewMutation);

  return (
    <>
      <Meta title="Analytics" />
      <Hero />
      <main className="flex flex-col items-center justify-center">
        <div className="container max-w-[1200px] gap-12 px-4 pb-28 pt-8">
          {pageViews && votes && (
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
              <h1 className="mb-0 mt-[60px]">Location data</h1>
              <SimpleGrid
                cols={3}
                spacing="md"
                breakpoints={[{ maxWidth: "md", cols: 1 }]}
              >
                <BarChart
                  headline={"Countries"}
                  data={aggregatedVisitorInfo?.countryCounts ?? []}
                />
                <BarChart
                  headline={"Regions"}
                  data={aggregatedVisitorInfo?.regionCounts ?? []}
                />
                <BarChart
                  headline={"Cities"}
                  data={aggregatedVisitorInfo?.cityCounts ?? []}
                />
              </SimpleGrid>
              <h1 className="mb-0 mt-[60px]">User Agent data</h1>
              <SimpleGrid
                cols={3}
                spacing="md"
                breakpoints={[{ maxWidth: "md", cols: 1 }]}
              >
                <BarChart
                  headline={"Operating Systems"}
                  data={aggregatedVisitorInfo?.osCounts ?? []}
                />
                <BarChart
                  headline={"Devices"}
                  data={aggregatedVisitorInfo?.deviceCounts ?? []}
                />
                <BarChart
                  headline={"Browsers"}
                  data={aggregatedVisitorInfo?.browserCounts ?? []}
                />
              </SimpleGrid>
            </>
          )}
        </div>
      </main>
    </>
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
