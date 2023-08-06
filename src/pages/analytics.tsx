import { type NextPage } from "next";
import React from "react";
import { Hero } from "fpp/components/layout/hero";
import { api } from "fpp/utils/api";
import { useLocalstorageStore } from "fpp/store/local-storage.store";
import {
  useTrackPageView,
  type UseTrackPageViewMutation,
} from "fpp/utils/use-tracking.hooks";
import { PageViewChart } from "fpp/components/charts/page-view-chart";
import { Card, SimpleGrid, Text } from "@mantine/core";
import { RouteType } from "@prisma/client";
import { Meta } from "fpp/components/meta";
import { log } from "fpp/utils/console-log";

const Imprint: NextPage = () => {
  const visitorId = useLocalstorageStore((state) => state.visitorId);
  const trackPageViewMutation =
    api.tracking.trackPageView.useMutation() as UseTrackPageViewMutation;
  useTrackPageView(RouteType.ANALYTICS, visitorId, trackPageViewMutation);

  const pageViews = api.tracking.getPageViews.useQuery().data;
  const votes = api.vote.getVotes.useQuery().data;
  log("pageViews", pageViews ?? {});
  log("votes", votes ?? {});

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
                <StatsCard name="Avg estimations" value={votes.voteAvg} />
                <StatsCard
                  name="Avg highest estimation"
                  value={votes.highestVoteAvg}
                />
              </SimpleGrid>
              <h1>Historical data</h1>
              <PageViewChart pageViews={pageViews} />
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

export default Imprint;
