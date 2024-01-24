import { env } from 'fpp/env.mjs';

import * as Sentry from '@sentry/nextjs';

import { logEndpoint } from 'fpp/constants/logging.constant';

import { createTRPCRouter, publicProcedure } from 'fpp/server/api/trpc';
import { type EventType, type RouteType } from 'fpp/server/db/schema';

const countryRegions =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('country-region-data/data.json') as CountryRegionData[];

export const analyticsRouter = createTRPCRouter({
  getAnalytics: publicProcedure.query(async ({ ctx: { db } }) => {
    const analytics = (await fetch(env.ANALYTICS_URL, {
      headers: {
        Authorization: env.ANALYTICS_SECRET_TOKEN,
      },
    })
      .then((res) => res.json())
      .catch((e) => {
        console.error('Error fetching analytics', e);
        Sentry.captureException(e, {
          tags: {
            endpoint: logEndpoint.GET_ANALYTICS,
          },
        });
      })) as AnalyticsResponse;

    const countryCounts: Record<string, number> = {};
    Object.entries(analytics.location_and_user_agent.country).forEach(
      ([country, count]) => {
        const countryName = `${country} - ${
          countryRegions.find((c) => c.countryShortCode === country)
            ?.countryName ?? country
        }`;
        countryCounts[countryName] = count;
      },
    );

    const regionCounts: Record<string, number> = {};
    analytics.location_and_user_agent.country_region.forEach((i) => {
      const regionName = `${i.country} - ${
        countryRegions
          .find((c) => c.countryShortCode === i.country)
          ?.regions.find((r) => r.shortCode === i.region)?.name ?? i.region
      }`;
      regionCounts[regionName] = i.count;
    });

    const cityCounts: Record<string, number> = {};
    analytics.location_and_user_agent.country_city.forEach((i) => {
      const cityName = `${i.country} - ${i.city}`;
      cityCounts[cityName] = i.count;
    });

    const analyticsResult: AnalyticsResult = {
      ...analytics,
      location_and_user_agent: {
        browser: analytics.location_and_user_agent.browser,
        country: countryCounts,
        city: cityCounts,
        region: regionCounts,
        device: analytics.location_and_user_agent.device,
        os: analytics.location_and_user_agent.os,
      },
    };

    return analyticsResult;
  }),
});

interface AnalyticsResponse {
  behaviour: {
    events: Record<keyof typeof EventType, number>;
    routes: Record<keyof typeof RouteType, number>;
    rooms: Record<string, number>;
  };
  historical: {
    date: string;
    estimations: number;
    acc_estimations: number;
    votes: number;
    acc_votes: number;
    page_views: number;
    acc_page_views: number;
    new_users: number;
    acc_new_users: number;
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
  };
}

type ModifiedAnalyticsResponse = Omit<
  AnalyticsResponse,
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

interface AnalyticsResult extends ModifiedAnalyticsResponse {
  location_and_user_agent: LocationAndUserAgent;
}

type CountryRegionData = {
  countryName: string;
  countryShortCode: string;
  regions: { name: string; shortCode: string }[];
};
