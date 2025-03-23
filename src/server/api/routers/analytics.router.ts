import { env } from 'fpp/env';

import * as Sentry from '@sentry/nextjs';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';
import { type EventType, type RouteType } from 'fpp/server/db/schema';

const countryRegions =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('country-region-data/data.json') as CountryRegionData[];

export const analyticsRouter = createTRPCRouter({
  getAnalytics: publicProcedure.query(async ({ ctx }) => {
    try {
      console.log('[Analytics Router] Fetching new data...');
      const response = await fetch(env.ANALYTICS_URL, {
        headers: {
          Authorization: env.ANALYTICS_SECRET_TOKEN,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Analytics API responded with status: ${response.status}`,
        );
      }

      const analytics = (await response.json()) as AnalyticsResponse;
      console.log('[Analytics Router] Received data:', {
        timestamp: analytics.cache.last_updated,
        status: analytics.cache.status,
      });

      // Add a unique key to force updates
      const uniqueKey = `${Date.now()}-${Math.random()}`;
      console.log('[Analytics Router] Generated unique key:', uniqueKey);

      const countryCounts: Record<string, number> = {};
      Object.entries(analytics.data.location_and_user_agent.country).forEach(
        ([country, count]) => {
          const countryName = `${country} - ${
            countryRegions.find((c) => c.countryShortCode === country)
              ?.countryName ?? country
          }`;
          countryCounts[countryName] = count;
        },
      );

      const regionCounts: Record<string, number> = {};
      analytics.data.location_and_user_agent.country_region.forEach((i) => {
        const regionName = `${i.country} - ${
          countryRegions
            .find((c) => c.countryShortCode === i.country)
            ?.regions.find((r) => r.shortCode === i.region)?.name ?? i.region
        }`;
        regionCounts[regionName] = i.count;
      });

      const cityCounts: Record<string, number> = {};
      analytics.data.location_and_user_agent.country_city.forEach((i) => {
        const cityName = `${i.country} - ${i.city}`;
        cityCounts[cityName] = i.count;
      });

      const weekdayOrder: (keyof Record<string, number>)[] = [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ];

      // Create a sorted version of the weekday_counts
      const sortedWeekdayCounts: Record<string, number> = weekdayOrder.reduce(
        (acc, day) => {
          if (analytics.data.votes.weekday_counts[day] !== undefined) {
            acc[day] = analytics.data.votes.weekday_counts[day]!;
          }
          return acc;
        },
        {} as Record<string, number>,
      );

      const analyticsResult: AnalyticsResult = {
        ...analytics.data,
        location_and_user_agent: {
          browser: analytics.data.location_and_user_agent.browser,
          country: countryCounts,
          city: cityCounts,
          region: regionCounts,
          device: analytics.data.location_and_user_agent.device,
          os: analytics.data.location_and_user_agent.os,
        },
        votes: {
          ...analytics.data.votes,
          weekday_counts: sortedWeekdayCounts,
        },
        cache: {
          last_updated: analytics.cache.last_updated,
          age_seconds: analytics.cache.age_seconds,
          status: analytics.cache.status,
          next_update_in: analytics.cache.next_update_in,
          timestamp: new Date().toISOString(),
          uniqueKey,
        },
        duration: analytics.duration,
        _timestamp: Date.now(),
      };

      console.log('[Analytics Router] Returning processed data:', {
        timestamp: analyticsResult._timestamp,
        uniqueKey: analyticsResult.cache.uniqueKey,
      });

      return analyticsResult;
    } catch (e) {
      console.error('Error fetching analytics', e);
      Sentry.captureException(e, {
        tags: {
          endpoint: logEndpoint.GET_ANALYTICS,
        },
      });
      throw e;
    }
  }),
  getServerAnalytics: publicProcedure.query(async () => {
    try {
      const response = await fetch(
        'https://server.free-planning-poker.com/analytics',
        {
          cache: 'no-cache',
        },
      );

      if (!response.ok) {
        throw new Error(
          `Server analytics API responded with status: ${response.status}`,
        );
      }

      return response.json() as Promise<ServerAnalytics>;
    } catch (e) {
      console.error('Error fetching server analytics', e);
      Sentry.captureException(e, {
        tags: {
          endpoint: logEndpoint.GET_SERVER_ANALYTICS,
        },
      });
      throw e;
    }
  }),
});

interface AnalyticsResponse {
  data: {
    behaviour: {
      events: Record<keyof typeof EventType, number>;
      sources: Record<string, number>;
      routes: Record<keyof typeof RouteType, number>;
      rooms: Record<string, number>;
    };
    reoccurring: {
      date: string;
      reoccurring_users: number;
      reoccurring_rooms: number;
      adjusted_reoccurring_users: number;
      adjusted_reoccurring_rooms: number;
    }[];
    historical: {
      date: string;
      estimations: number;
      acc_estimations: number;
      ma_estimations: number;
      votes: number;
      acc_votes: number;
      ma_votes: number;
      page_views: number;
      acc_page_views: number;
      ma_page_views: number;
      new_users: number;
      acc_new_users: number;
      ma_new_users: number;
      rooms: number;
      acc_rooms: number;
      ma_rooms: number;
    }[];
    location_and_user_agent: {
      browser: Record<string, number>;
      country: Record<string, number>;
      country_city: {
        country: string;
        city: string;
        count: number;
      }[];
      country_region: {
        country: string;
        region: string;
        count: number;
      }[];
      device: Record<string, number>;
      os: Record<string, number>;
    };
    traffic: {
      average_duration: number;
      bounce_rate: number;
      page_views: number;
      unique_users: number;
    };
    votes: {
      avg_duration_per_vote: number;
      avg_estimation: number;
      avg_estimations_per_vote: number;
      avg_max_estimation: number;
      avg_min_estimation: number;
      avg_spectators_per_vote: number;
      total_estimations: number;
      total_votes: number;
      weekday_counts: Record<string, number>;
      estimation_counts: Record<string, number>;
    };
  };
  cache: {
    last_updated: string;
    age_seconds: number;
    status: 'fresh' | 'ok' | 'stale';
    next_update_in: number;
  };
  duration: number;
}

type ModifiedAnalyticsResponse = Omit<
  AnalyticsResponse['data'],
  'location_and_user_agent'
>;

interface LocationAndUserAgent {
  browser: Record<string, number>;
  country: Record<string, number>;
  city: Record<string, number>;
  region: Record<string, number>;
  device: Record<string, number>;
  os: Record<string, number>;
}

export interface AnalyticsResult extends ModifiedAnalyticsResponse {
  location_and_user_agent: LocationAndUserAgent;
  cache: {
    last_updated: string;
    age_seconds: number;
    status: 'fresh' | 'ok' | 'stale';
    next_update_in: number;
    timestamp: string;
    uniqueKey: string;
  };
  duration: number;
  _timestamp: number;
}

type CountryRegionData = {
  countryName: string;
  countryShortCode: string;
  regions: { name: string; shortCode: string }[];
};

export interface ServerAnalytics {
  connectedUsers: number;
  openRooms: number;
  rooms: {
    userCount: number;
    firstActive: number;
    firstActiveReadable: string;
    lastActive: number;
    lastActiveReadable: string;
    lastUpdated: number;
    lastUpdatedReadable: string;
    users: {
      estimation: number | null;
      isSpectator: boolean;
      firstActive: number;
      firstActiveReadable: string;
      lastActive: number;
      lastActiveReadable: string;
    }[];
  }[];
}
