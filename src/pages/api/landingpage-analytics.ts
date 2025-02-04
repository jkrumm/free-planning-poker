import { type NextRequest } from 'next/server';

import { env } from 'fpp/env';

// export const config = {
//   runtime: 'edge',
// };

export const preferredRegion = 'fra1';

interface LandingPageAnalytics {
  estimation_count: number;
  user_count: number;
}

export default async function handler(req: NextRequest) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  let data: LandingPageAnalytics = {
    estimation_count: 0,
    user_count: 0,
  };

  try {
    const response = await fetch(env.ANALYTICS_URL + '/landingpage-analytics', {
      headers: {
        Authorization: env.ANALYTICS_SECRET_TOKEN,
      },
      next: { revalidate: 300 }, // 5 minute cache
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch analytics: ${response.statusText}`);
    }

    const analytics = (await response.json()) as LandingPageAnalytics;
    data = analytics;

    return new Response(JSON.stringify(analytics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300', // 5 minute cache
      },
    });
  } catch (error) {
    console.error('Error fetching landing page analytics:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      data: JSON.stringify(data),
    });
    return new Response(
      JSON.stringify({
        estimation_count: 17000,
        user_count: 3400,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=300',
        },
      },
    );
  }
}
