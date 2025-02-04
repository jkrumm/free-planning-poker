import { env } from 'fpp/env';

export const config = {
  runtime: 'edge',
};

export const preferredRegion = 'fra1';

interface LandingPageAnalytics {
  estimation_count: number;
  user_count: number;
}

const LandingPageAnalytics = async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const headers = new Headers({
      Authorization: env.ANALYTICS_SECRET_TOKEN,
      'Content-Type': 'application/json',
    });

    const response = await fetch(env.ANALYTICS_URL + '/landingpage-analytics', {
      method: 'GET',
      headers,
      keepalive: true,
      redirect: 'follow',
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error('Failed to fetch analytics:', {
        status: response.status,
        url: env.ANALYTICS_URL + '/landingpage-analytics',
        statusText: response.statusText,
        body: await response.text().catch(() => 'Could not read body'),
      });

      // Return fallback data if the analytics service fails
      return new Response(
        JSON.stringify({
          estimation_count: 19000,
          user_count: 4000,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=300', // 5 minute cache
          },
        },
      );
    }

    const analytics = (await response.json()) as LandingPageAnalytics;

    return new Response(JSON.stringify(analytics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300', // 5 minute cache
      },
    });
  } catch (error) {
    console.error('Error fetching landing page analytics:', error);

    // Return fallback data in case of error
    return new Response(
      JSON.stringify({
        estimation_count: 19000,
        user_count: 4000,
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
