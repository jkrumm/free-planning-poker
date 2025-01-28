import { type NextRequest } from 'next/server';

import { env } from 'fpp/env';

export const config = {
  runtime: 'edge',
};

interface LandingPageAnalytics {
  estimation_count: number;
  user_count: number;
}

export default async function handler(req: NextRequest) {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const analytics = await fetch(
      env.ANALYTICS_URL + '/landingpage-analytics',
      {
        headers: {
          Authorization: env.ANALYTICS_SECRET_TOKEN,
        },
        next: { revalidate: 300 }, // 5 minute cache
      },
    ).then((res) => res.json() as Promise<LandingPageAnalytics>);

    return new Response(JSON.stringify(analytics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300', // 5 minute cache
      },
    });
  } catch (error) {
    console.error('Error fetching landing page analytics:', error);
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
