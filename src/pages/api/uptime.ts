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

const fetchFromBetterStack = async (): Promise<Uptime[]> => {
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
      cache: 'force-cache',
      next: { revalidate: 300 }, // 5 minute cache
    },
  );

  if (!response.ok) {
    console.error('Failed to fetch uptime:', {
      status: response.status,
      url: 'https://uptime.betterstack.com/api/v2/monitors',
      statusText: response.statusText,
      body: await response.text().catch(() => 'Could not read body'),
    });

    return [
      { name: 'FFP - Server', status: 'down' },
      { name: 'FPP - Analytics', status: 'down' },
    ];
  }

  const data = (await response.json()) as BetterStackMonitor;

  return data.data
    .filter(
      (monitor) =>
        monitor.attributes.pronounceable_name === 'FFP - Server' ||
        monitor.attributes.pronounceable_name === 'FPP - Analytics',
    )
    .map((monitor) => ({
      name: monitor.attributes.pronounceable_name as Uptime['name'],
      status: monitor.attributes.status,
    }));
};

const LandingPageAnalytics = async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const data = await fetchFromBetterStack();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
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
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        },
      },
    );
  }
};

export default LandingPageAnalytics;
