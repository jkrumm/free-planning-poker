import { env } from 'fpp/env';

export const config = {
  runtime: 'edge',
};

export const preferredRegion = 'fra1';

interface BetterStackMonitor {
  data: {
    attributes: {
      pronounceable_name: string;
      status:
        | 'up'
        | 'down'
        | 'paused'
        | 'pending'
        | 'maintenance'
        | 'validating';
    };
  }[];
}

export interface Uptime {
  name: 'FFP - Server' | 'FPP - Analytics';
  status: 'up' | 'down' | 'paused' | 'pending' | 'maintenance' | 'validating';
}

const LandingPageAnalytics = async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const headers = new Headers({
      Authorization: env.UPTIME_SECRET_TOKEN,
      'Content-Type': 'application/json',
    });

    const response = await fetch(
      'https://uptime.betterstack.com/api/v2/monitors',
      {
        method: 'GET',
        headers,
        keepalive: true,
        redirect: 'follow',
        next: { revalidate: 300 },
      },
    );

    if (!response.ok) {
      console.error('Failed to fetch uptime:', {
        status: response.status,
        url: 'https://uptime.betterstack.com/api/v2/monitors',
        statusText: response.statusText,
        body: await response.text().catch(() => 'Could not read body'),
      });

      return new Response(
        JSON.stringify([
          { name: 'FFP - Server', status: 'down' },
          { name: 'FPP - Analytics', status: 'down' },
        ] as Uptime[]),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, s-maxage=300',
          },
        },
      );
    }

    const data = (await response.json()) as BetterStackMonitor;

    const relevantServices: Uptime[] = data.data
      .filter(
        (monitor) =>
          monitor.attributes.pronounceable_name === 'FFP - Server' ||
          monitor.attributes.pronounceable_name === 'FPP - Analytics',
      )
      .map((monitor) => ({
        name: monitor.attributes.pronounceable_name as Uptime['name'],
        status: monitor.attributes.status,
      }));

    return new Response(JSON.stringify(relevantServices), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300', // 5 minute cache
      },
    });
  } catch (error) {
    console.error('Error fetching uptime status:', error);
    return new Response(
      JSON.stringify([
        { name: 'FFP - Server', status: 'down' },
        { name: 'FPP - Analytics', status: 'down' },
      ] as Uptime[]),
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
