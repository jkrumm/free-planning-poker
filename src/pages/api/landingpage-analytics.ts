import { type NextApiRequest } from 'next';

import { env } from 'fpp/env';

export const preferredRegion = 'fra1';

interface LandingPageAnalytics {
  estimation_count: number;
  user_count: number;
}

const LandingPageAnalytics = async (req: NextApiRequest) => {
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
      console.error('Failed to fetch analytics:', {
        status: response.status,
        url: env.ANALYTICS_URL + '/landingpage-analytics',
        statusText: response.statusText,
        body: await response.text(),
        auth: env.ANALYTICS_SECRET_TOKEN.slice(0, 5) + '...',
      });
      return new Response(response.statusText, {
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
        },
      });
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
};

export default LandingPageAnalytics;
