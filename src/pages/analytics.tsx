import React from 'react';

import dynamic from 'next/dynamic';
import Link from 'next/link';

import {
  Badge,
  Button,
  Group,
  Loader,
  RingProgress,
  SimpleGrid,
  Switch,
  Table,
  Text,
  Tooltip,
} from '@mantine/core';

import { api } from 'fpp/utils/api';
import {
  addBreadcrumb,
  captureError,
  captureMessage,
} from 'fpp/utils/app-error';

import { RouteType } from 'fpp/server/db/schema';

import { useTrackPageView } from 'fpp/hooks/use-tracking.hook';

import { AnalyticsCard } from 'fpp/components/analytics/analytics-card';
import { HistoricalTable } from 'fpp/components/analytics/historical-table';
import { ReoccurringChart } from 'fpp/components/analytics/reoccurring-chart';
import { SentryIssuesTable } from 'fpp/components/analytics/sentry-issues-table';
import { StatsCard } from 'fpp/components/analytics/stats-card';
import Footer from 'fpp/components/layout/footer';
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
    <Loader size="xl" />
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

// Custom hooks for analytics queries with error handling
function useAnalyticsQuery() {
  const query = api.analytics.getAnalytics.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  React.useEffect(() => {
    if (query.error) {
      captureError(
        query.error instanceof Error
          ? query.error
          : new Error('Failed to fetch analytics data'),
        {
          component: 'Analytics',
          action: 'fetchAnalytics',
        },
        'medium',
      );
    }
  }, [query.error]);

  return query;
}

function useServerAnalyticsQuery() {
  const query = api.analytics.getServerAnalytics.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  React.useEffect(() => {
    if (query.error) {
      captureError(
        query.error instanceof Error
          ? query.error
          : new Error('Failed to fetch server analytics data'),
        {
          component: 'Analytics',
          action: 'fetchServerAnalytics',
        },
        'medium',
      );
    }
  }, [query.error]);

  return query;
}

function useSentryIssuesQuery() {
  const query = api.sentry.getIssues.useQuery(undefined, {
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  React.useEffect(() => {
    if (query.error) {
      captureError(
        query.error instanceof Error
          ? query.error
          : new Error('Failed to fetch Sentry issues'),
        {
          component: 'Analytics',
          action: 'fetchSentryIssues',
        },
        'low',
      );
    }
  }, [query.error]);

  return query;
}

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const time = new Date(timestamp);
  const timeString = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (seconds < 60) {
    return `${timeString} (${seconds}s ago)`;
  } else if (minutes < 60) {
    return `${timeString} (${minutes}m ago)`;
  } else if (hours < 24) {
    return `${timeString} (${hours}h ago)`;
  } else if (days < 7) {
    return `${timeString} (${days}d ago)`;
  } else {
    return time.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
};

const sortUsers = (
  users: {
    estimation: number | null;
    isSpectator: boolean;
    firstActive: number;
    firstActiveReadable: string;
    lastActive: number;
    lastActiveReadable: string;
  }[],
) => {
  return [...users].sort((a, b) => {
    // First: users with estimations
    if (a.estimation !== null && b.estimation === null && !b.isSpectator)
      return -1;
    if (b.estimation !== null && a.estimation === null && !a.isSpectator)
      return 1;

    // Second: users without estimations (but not spectators)
    if (!a.isSpectator && b.isSpectator) return -1;
    if (!b.isSpectator && a.isSpectator) return 1;

    // Third: spectators
    // Within same category, maintain original order
    return 0;
  });
};

const getUserBadgeColor = (user: {
  estimation: number | null;
  isSpectator: boolean;
}) => {
  if (user.isSpectator) return 'gray';
  return user.estimation !== null ? 'green' : 'orange';
};

const getUserBadgeVariant = (user: {
  estimation: number | null;
  isSpectator: boolean;
}) => {
  if (user.isSpectator) return 'outline';
  return user.estimation !== null ? 'filled' : 'light';
};

const getUserDisplayText = (user: {
  estimation: number | null;
  isSpectator: boolean;
}) => {
  if (user.isSpectator) {
    return `👁`;
  }
  return user.estimation !== null ? `🎯 ${user.estimation}` : `⏳`;
};

const formatDataAge = (isoTimestamp: string | null | undefined): string => {
  if (!isoTimestamp) return '';
  const updatedAt = new Date(isoTimestamp).getTime();
  const now = Date.now();
  const diffSeconds = Math.floor((now - updatedAt) / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return `${Math.floor(diffSeconds / 86400)}d ago`;
};

const Analytics = () => {
  const [hasInitialized, setHasInitialized] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(0);
  const [dataAge, setDataAge] = React.useState('');
  const [historicalTableOpen, setHistoricalTableOpen] = React.useState(true);
  const [reduceReoccurring, setReduceReoccurring] = React.useState(true);

  useTrackPageView(RouteType.ANALYTICS);

  const {
    data: analytics,
    refetch: refetchAnalytics,
    error: analyticsError,
    isError: analyticsIsError,
    isLoading: analyticsIsLoading,
    dataUpdatedAt,
  } = useAnalyticsQuery();

  const {
    data: serverAnalytics,
    refetch: refetchServerAnalytics,
    error: serverAnalyticsError,
    isError: serverAnalyticsIsError,
    isLoading: serverAnalyticsIsLoading,
  } = useServerAnalyticsQuery();

  const {
    data: sentryIssues,
    refetch: refetchGetIssues,
    error: sentryError,
    isError: sentryIsError,
    isLoading: sentryIsLoading,
  } = useSentryIssuesQuery();

  const refetch = () => {
    addBreadcrumb('Analytics manual refresh triggered', 'interaction');
    void refetchAnalytics();
    void refetchServerAnalytics();
    void refetchGetIssues();
  };

  // Handle countdown display for 30-second refresh interval and data age
  React.useEffect(() => {
    if (!dataUpdatedAt) return;

    const updateTimers = () => {
      const now = Date.now();
      const nextUpdate = dataUpdatedAt + 30000; // 30 seconds from last update
      const remaining = Math.max(0, Math.round((nextUpdate - now) / 1000));
      setSecondsLeft(remaining);
      setDataAge(formatDataAge(analytics?.data_updated_at));
    };

    // Initial update
    updateTimers();

    // Update every second
    const intervalId = setInterval(updateTimers, 1000);
    return () => clearInterval(intervalId);
  }, [dataUpdatedAt, analytics?.data_updated_at]);

  // Calculate progress for the ring (0-100)
  const updateProgress = React.useMemo(() => {
    if (!dataUpdatedAt) return 0;
    // eslint-disable-next-line react-hooks/purity -- Valid pattern: Date.now() in useMemo for progress calculation, depends on secondsLeft re-render
    const now = Date.now();
    const elapsed = (now - dataUpdatedAt) / 1000;
    const progress = (elapsed / 30) * 100; // 30 seconds total duration
    return Math.min(Math.max(progress, 0), 100);
  }, [dataUpdatedAt, secondsLeft]);

  // Determine color based on time remaining
  const refreshStatusColor = React.useMemo(() => {
    if (secondsLeft > 20) return 'green';
    if (secondsLeft > 10) return 'yellow';
    return 'orange';
  }, [secondsLeft]);

  // Handle toggle functions with error handling
  const handleHistoricalTableToggle = () => {
    setHistoricalTableOpen(!historicalTableOpen);
    addBreadcrumb('Historical table view toggled', 'interaction', {
      newState: !historicalTableOpen,
    });
  };

  const handleReduceReoccurringToggle = () => {
    setReduceReoccurring(!reduceReoccurring);
    addBreadcrumb('Reoccurring data reduction toggled', 'interaction', {
      newState: !reduceReoccurring,
    });
  };

  // Initialize tracking
  if (!hasInitialized) {
    addBreadcrumb('Analytics page initialized', 'page', {
      hasAnalytics: !!analytics,
      hasServerAnalytics: !!serverAnalytics,
      hasSentryIssues: !!sentryIssues,
    });
    setHasInitialized(true);
  }

  // Handle loading states
  const isLoading =
    analyticsIsLoading || serverAnalyticsIsLoading || sentryIsLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader size="xl" />
      </div>
    );
  }

  // Handle critical errors (missing core analytics data)
  if (
    analyticsIsError ||
    !analytics ||
    serverAnalyticsIsError ||
    !serverAnalytics
  ) {
    captureError(
      'Critical analytics data missing',
      {
        component: 'Analytics',
        action: 'checkCriticalData',
        extra: {
          analyticsError: analyticsError?.message ?? 'undefined',
          serverAnalyticsError: serverAnalyticsError?.message ?? 'undefined',
          hasAnalytics: !!analytics,
          hasServerAnalytics: !!serverAnalytics,
        },
      },
      'high',
    );

    return (
      <div>
        <Meta title="Analytics - Error" />
        <Navbar />
        <Hero />
        <main className="flex flex-col items-center justify-center">
          <section className="container max-w-[800px] gap-12 px-4 mt-6 mb-8">
            <Text className="mb-4">
              Sorry, there was an error loading the analytics data. Please try
              refreshing the page.
            </Text>
            <Button
              variant="outline"
              color="gray"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </Button>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  // Warn about Sentry issues but continue
  if (sentryIsError) {
    captureMessage(
      'Sentry issues failed to load, continuing without them',
      {
        component: 'Analytics',
        action: 'loadSentryIssues',
        extra: { error: sentryError?.message },
      },
      'warning',
    );
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
    <div>
      <Meta title="Analytics" />
      <Navbar />
      <Hero />
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
        <section className="container max-w-[1200px] gap-12 px-4 pb-12 pt-8">
          <div className="flex w-full justify-evenely items-center">
            <div className="flex-1 flex justify-start">
              <h2>Live</h2>
            </div>

            <div className="flex-1 flex justify-center pl-7 pb-2"></div>
            <div className="flex-1 flex justify-end items-center">
              {dataAge && (
                <Text size="xs" c="dimmed" className="mr-3">
                  Analytics updated {dataAge}
                </Text>
              )}
              <Tooltip label={`Next refresh in ${secondsLeft}s`}>
                <div className="flex items-center">
                  <RingProgress
                    className="mr-3"
                    size={40}
                    thickness={4}
                    sections={[
                      {
                        value: updateProgress,
                        color: refreshStatusColor,
                      },
                    ]}
                    label={
                      <Text ta="center" size="xs">
                        {secondsLeft}s
                      </Text>
                    }
                  />
                </div>
              </Tooltip>
              <Button onClick={refetch} color="gray" variant="light">
                Refresh
              </Button>
            </div>
          </div>
          <SimpleGrid
            cols={{
              xs: 2,
              sm: 2,
              md: 2,
            }}
            spacing="md"
            className="pb-4"
          >
            <StatsCard name="Open Rooms" value={serverAnalytics.openRooms} />
            <StatsCard
              name="Connected Users"
              value={serverAnalytics.connectedUsers}
            />
          </SimpleGrid>
          <SimpleGrid
            cols={{
              xs: 2,
              sm: 2,
              md: 4,
            }}
            spacing="md"
            className="pb-4"
          >
            <StatsCard
              name="Today Estimations"
              value={historical[historical.length - 1]?.estimations ?? 0}
            />
            <StatsCard
              name="Today Votes"
              value={historical[historical.length - 1]?.votes ?? 0}
            />
            <StatsCard
              name="Today Users"
              value={historical[historical.length - 1]?.new_users ?? 0}
            />
            <StatsCard
              name="Today Rooms"
              value={historical[historical.length - 1]?.rooms ?? 0}
            />
          </SimpleGrid>
          {/* Active Rooms Table */}
          <Table.ScrollContainer minWidth={800}>
            <Table striped highlightOnHover withTableBorder mt={0}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th pl={4}>Room</Table.Th>
                  <Table.Th>Users</Table.Th>
                  <Table.Th style={{ minWidth: '125px' }}>
                    First Active
                  </Table.Th>
                  <Table.Th style={{ minWidth: '125px' }}>
                    Last Updated
                  </Table.Th>
                  <Table.Th>Members</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {serverAnalytics.rooms
                  .filter((room) => room.userCount > 1)
                  .sort((a, b) => b.lastUpdated - a.lastUpdated)
                  .map((room, roomIndex) => {
                    const sortedUsers = sortUsers(room.users);

                    return (
                      <Table.Tr key={roomIndex}>
                        <Table.Td>
                          <Text fw={500} pl={4}>
                            Room {roomIndex + 1}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="blue">
                            {room.userCount}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ minWidth: '130px' }}>
                          <Text size="sm" c="dimmed">
                            {formatTimeAgo(room.firstActive)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ minWidth: '130px' }}>
                          <Text size="sm" c="dimmed">
                            {formatTimeAgo(room.lastUpdated)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            {sortedUsers.map((user, userIndex) => (
                              <Tooltip
                                key={userIndex}
                                label={
                                  <div>
                                    <Text size="sm" fw={500}>
                                      {user.isSpectator
                                        ? 'Spectator'
                                        : user.estimation !== null
                                          ? `Estimation: ${user.estimation}`
                                          : 'No estimation yet'}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      First Active:{' '}
                                      {formatTimeAgo(user.firstActive)}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      Last Active:{' '}
                                      {formatTimeAgo(user.lastActive)}
                                    </Text>
                                  </div>
                                }
                                multiline
                                withArrow
                              >
                                <Badge
                                  variant={getUserBadgeVariant(user)}
                                  color={getUserBadgeColor(user)}
                                  size="sm"
                                  style={{ cursor: 'help' }}
                                >
                                  {getUserDisplayText(user)}
                                </Badge>
                              </Tooltip>
                            ))}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                {serverAnalytics.rooms.filter((room) => room.userCount > 1)
                  .length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5}>
                      <Text c="dimmed" ta="center" py={12}>
                        No active rooms with multiple users found
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

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
              onChange={handleReduceReoccurringToggle}
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
              onChange={handleHistoricalTableToggle}
            />
          </div>
          <HistoricalTable
            historical={historical.reverse()}
            historicalTableOpen={historicalTableOpen}
          />
          <HistoricalChart historical={historical} />

          {!sentryIsError && sentryIssues && (
            <>
              <h2 className="pt-8">Sentry Issues</h2>
              <SentryIssuesTable issues={sentryIssues} />
            </>
          )}

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
      <Footer />
    </div>
  );
};

export default Analytics;
