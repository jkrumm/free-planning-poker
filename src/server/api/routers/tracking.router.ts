import { createTRPCRouter, publicProcedure } from "fpp/server/api/trpc";
import { DateTime } from "luxon";
import { countTable } from "fpp/utils/db-api.util";
import { pageViews, visitors } from "fpp/server/db/schema";
import { sql } from "drizzle-orm";
import { env } from "fpp/env.mjs";

const countryRegions =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("country-region-data/data.json") as CountryRegionData[];

export const trackingRouter = createTRPCRouter({
  getPageViews: publicProcedure.query<PageViews>(async ({ ctx: { db } }) => {
    if (env.NEXT_PUBLIC_NODE_ENV !== "development") {
      return samplePageViews;
    }

    const total = await countTable(db, pageViews);
    const unique = await countTable(db, visitors);
    const viewsPerVisit = Math.ceil((total / unique) * 100) / 100;

    const activities = await db.get<
      { visitorId: string; activityAt: Date }[]
    >(sql`
        SELECT visitorId, viewedAt as activityAt
        FROM fpp_page_views
        UNION ALL
        SELECT visitorId, estimatedAt as activityAt
        FROM fpp_estimations
        ORDER BY visitorId, activityAt;
    `);

    let totalDuration = 0;
    let totalActivities = 0;
    let currentVisitorId = null;
    let currentSessionStart = null;

    for (const activity of activities) {
      if (
        !currentVisitorId ||
        currentVisitorId !== activity.visitorId ||
        !currentSessionStart
      ) {
        totalActivities++;
        currentVisitorId = activity.visitorId;
        currentSessionStart = activity.activityAt;
      } else {
        const duration =
          activity.activityAt.getTime() - currentSessionStart.getTime();
        if (duration <= 10 * 60 * 1000) {
          totalDuration += duration;
          currentSessionStart = activity.activityAt;
        } else {
          totalDuration += 15 * 1000;
          totalActivities++;
          currentVisitorId = null;
        }
      }
    }

    const duration =
      Math.ceil((totalDuration / (totalActivities || 1) / (60 * 1000)) * 100) /
      100;

    const visitorsWhoVotedRes = await db.get<
      { hasVoted: string }[]
    >(sql`SELECT COUNT(*)
        FROM (SELECT COUNT(*) as hasVoted FROM fpp_estimations GROUP BY visitorId) as subQuery;`);
    const visitorsWhoVoted = parseInt(visitorsWhoVotedRes[0]?.hasVoted ?? "0");
    const bounceRate = 100 - Math.ceil((visitorsWhoVoted / unique) * 100);

    const totalViews = await db.get<
      {
        date: Date;
        count: string;
      }[]
    >(sql`SELECT DATE(viewedAt) AS date, COUNT(*) AS count 
        FROM fpp_page_views
        GROUP BY date 
        ORDER BY date DESC;`);

    const uniqueViews = await db.get<
      {
        date: Date;
        count: string;
      }[]
    >(sql`SELECT DATE(startedAt) AS date, COUNT(*) AS count
        FROM fpp_visitors
        GROUP BY date
        ORDER BY date DESC;`);

    const totalVotes = await db.get<
      { date: Date; count: string }[]
    >(sql`SELECT DATE(estimatedAt) AS date, COUNT(*) AS count
        FROM fpp_estimations
        GROUP BY date
        ORDER BY date DESC;`);

    return {
      stats: {
        total,
        unique,
        avgPerDay: Math.ceil(total / totalViews.length),
        viewsPerVisit,
        duration,
        bounceRate,
      },
      totalViews: totalViews.map((i) => ({
        date: DateTime.fromJSDate(i.date).toISODate()!,
        count: parseInt(i.count),
      })),
      uniqueViews: uniqueViews.map((i) => ({
        date: DateTime.fromJSDate(i.date).toISODate()!,
        count: parseInt(i.count),
      })),
      totalVotes: totalVotes.map((i) => ({
        date: DateTime.fromJSDate(i.date).toISODate()!,
        count: parseInt(i.count),
      })),
    };
  }),
  getAggregatedVisitorInfo: publicProcedure.query<AggregatedVisitorInfo>(
    async ({ ctx }) => {
      if (env.NEXT_PUBLIC_NODE_ENV !== "development") {
        return sampleAggregatedVisitorInfo;
      }

      const deviceCounts = await ctx.db.get<
        { device: string; count: number }[]
      >(
        sql`SELECT device, COUNT(*) AS count FROM fpp_visitors WHERE device IS NOT NULL GROUP BY device;`,
      );

      const osCounts = await ctx.db.get<{ os: string; count: number }[]>(
        sql`SELECT os, COUNT(*) AS count FROM fpp_visitors WHERE os IS NOT NULL GROUP BY os;`,
      );

      const browserCounts = await ctx.db.get<
        { browser: string; count: number }[]
      >(
        sql`SELECT browser, COUNT(*) AS count FROM fpp_visitors WHERE browser IS NOT NULL GROUP BY browser;`,
      );

      let countryCounts: { country: string; count: number }[] = [];
      try {
        countryCounts = await ctx.db.get<{ country: string; count: number }[]>(
          sql`SELECT country, COUNT(*) AS count FROM fpp_visitors WHERE country IS NOT NULL GROUP BY country;`,
        );
      } catch (e) {
        if (
          e instanceof Error &&
          e.message === "Cannot convert undefined or null to object"
        ) {
          countryCounts = [];
        } else {
          throw e;
        }
      }

      const countryCountsMapped = countryCounts.map((i) => ({
        name: `${i.country} - ${
          countryRegions.find((c) => c.countryShortCode === i.country)
            ?.countryName ?? i.country
        }`,
        value: i.count,
      }));

      let regionCounts: { region: string; country: string; count: number }[] =
        [];
      try {
        regionCounts = await ctx.db.get<
          { region: string; country: string; count: number }[]
        >(
          sql`SELECT region, country, COUNT(*) AS count FROM fpp_visitors WHERE region IS NOT NULL GROUP BY region;`,
        );
      } catch (e) {
        if (
          e instanceof Error &&
          e.message === "Cannot convert undefined or null to object"
        ) {
          regionCounts = [];
        } else {
          throw e;
        }
      }

      const regionCountsMapped = regionCounts.map((i) => ({
        name: `${i.country} - ${
          countryRegions
            .find((c) => c.countryShortCode === i.country)
            ?.regions.find((r) => r.shortCode === i.region)?.name ?? i.region
        }`,
        value: i.count,
      }));

      let cityCounts: { city: string; country: string; count: number }[] = [];
      try {
        cityCounts = await ctx.db.get<
          { city: string; country: string; count: number }[]
        >(
          sql`SELECT city, country, COUNT(*) AS count FROM fpp_visitors WHERE city IS NOT NULL GROUP BY city;`,
        );
      } catch (e) {
        if (
          e instanceof Error &&
          e.message === "Cannot convert undefined or null to object"
        ) {
          cityCounts = [];
        } else {
          throw e;
        }
      }

      const cityCountsMapped = cityCounts.map((i) => ({
        name: `${i.country} - ${i.city}`,
        value: i.count,
      }));

      return {
        deviceCounts: mapCounts(deviceCounts),
        osCounts: mapCounts(osCounts),
        browserCounts: mapCounts(browserCounts),
        countryCounts: countryCountsMapped,
        regionCounts: regionCountsMapped,
        cityCounts: cityCountsMapped,
      };
    },
  ),
});

type CountryRegionData = {
  countryName: string;
  countryShortCode: string;
  regions: { name: string; shortCode: string }[];
};

type CountData = Record<string, string | number | null>;

const mapCounts = (data: Array<CountData>) => {
  return data
    .filter((item) => Object.values(item)[0] !== null)
    .map((item) => {
      const name = Object.values(item).find(
        (value) => value !== item.count,
      ) as string;
      const value = item.count as number;
      return { name, value };
    });
};

export type CountResult = Array<{ name: string; value: number }>;

export interface AggregatedVisitorInfo {
  deviceCounts: CountResult;
  osCounts: CountResult;
  browserCounts: CountResult;
  countryCounts: CountResult;
  regionCounts: CountResult;
  cityCounts: CountResult;
}

export interface PageViews {
  stats: {
    total: number;
    unique: number;
    avgPerDay: number;
    viewsPerVisit: number;
    duration: number;
    bounceRate: number;
  };
  totalViews: { date: string; count: number }[];
  uniqueViews: { date: string; count: number }[];
  totalVotes: { date: string; count: number }[];
}

const sampleAggregatedVisitorInfo: AggregatedVisitorInfo = {
  deviceCounts: [
    { name: "Desktop", value: 200 },
    { name: "Mobile", value: 50 },
    { name: "Tablet", value: 30 },
  ],
  osCounts: [
    { name: "Windows", value: 100 },
    { name: "MacOS", value: 100 },
    { name: "Linux", value: 80 },
  ],
  browserCounts: [
    { name: "Chrome", value: 100 },
    { name: "Firefox", value: 50 },
    { name: "Safari", value: 70 },
    { name: "Edge", value: 10 },
    { name: "Opera", value: 30 },
    { name: "Other", value: 20 },
  ],
  countryCounts: [
    { name: "US - United States", value: 100 },
    { name: "DE - Germany", value: 50 },
    { name: "UK - United Kingdom", value: 70 },
    { name: "AU - Australia", value: 10 },
    { name: "PL - Poland", value: 30 },
  ],
  regionCounts: [
    { name: "US - California", value: 100 },
    { name: "US - Texas", value: 50 },
    { name: "US - New York", value: 70 },
    { name: "US - Florida", value: 10 },
    { name: "US - Illinois", value: 30 },
  ],
  cityCounts: [
    { name: "US - Los Angeles", value: 80 },
    { name: "US - New York", value: 50 },
    { name: "US - Chicago", value: 70 },
    { name: "US - Houston", value: 10 },
    { name: "US - Phoenix", value: 30 },
    { name: "US - Philadelphia", value: 20 },
    { name: "US - San Antonio", value: 20 },
  ],
};

const samplePageViews: PageViews = {
  stats: {
    total: 100,
    unique: 50,
    avgPerDay: 10,
    viewsPerVisit: 2,
    duration: 9.53,
    bounceRate: 70,
  },
  totalViews: [
    { date: "2021-01-01", count: 10 },
    { date: "2021-01-02", count: 20 },
    { date: "2021-01-03", count: 25 },
    { date: "2021-01-04", count: 40 },
    { date: "2021-01-05", count: 50 },
    { date: "2021-01-06", count: 60 },
    { date: "2021-01-07", count: 50 },
    { date: "2021-01-08", count: 40 },
  ],
  uniqueViews: [
    { date: "2021-01-01", count: 5 },
    { date: "2021-01-02", count: 10 },
    { date: "2021-01-03", count: 8 },
    { date: "2021-01-04", count: 10 },
    { date: "2021-01-05", count: 12 },
    { date: "2021-01-06", count: 15 },
    { date: "2021-01-07", count: 10 },
    { date: "2021-01-08", count: 8 },
  ],
  totalVotes: [
    { date: "2021-01-01", count: 15 },
    { date: "2021-01-02", count: 20 },
    { date: "2021-01-03", count: 25 },
    { date: "2021-01-04", count: 30 },
    { date: "2021-01-05", count: 25 },
    { date: "2021-01-06", count: 25 },
    { date: "2021-01-07", count: 45 },
    { date: "2021-01-08", count: 35 },
  ],
};