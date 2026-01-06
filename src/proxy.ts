import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from 'next/server';

import { env } from 'fpp/env';

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.fixedWindow(20, '10 s'),
  analytics: false,
});

const isAPI = (path: string) => {
  return /^\/api\//.exec(path);
};

export default async function proxy(
  request: NextRequest,
  event: NextFetchEvent,
): Promise<Response | undefined> {
  if (env.NEXT_PUBLIC_NODE_ENV === 'development') {
    return NextResponse.next();
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1';

  // Rate limit apis
  if (isAPI(request.nextUrl.pathname)) {
    const { success, pending, limit, reset, remaining } = await ratelimit.limit(
      `ratelimit_middleware_${ip}`,
    );
    event.waitUntil(pending);

    const res = success
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/api/blocked', request.url));

    res.headers.set('X-RateLimit-Limit', limit.toString());
    res.headers.set('X-RateLimit-Remaining', remaining.toString());
    res.headers.set('X-RateLimit-Reset', reset.toString());
    return res;
  }

  const { success, pending } = await ratelimit.limit(
    `ratelimit_middleware_${ip}`,
  );
  event.waitUntil(pending);

  return success
    ? NextResponse.next()
    : NextResponse.redirect(new URL('/blocked', request.url));
}

// Stop middleware from running on static files
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next
     * - static (static files)
     * - favicon.ico (favicon file)
     * - api/blocked (blocked api endpoint)
     * - blocked (blocked page)
     * - api/get-rooms (get-rooms api endpoint) (ssr)
     * - api/track-page-view (analytics tracking, safe to exempt)
     */
    '/((?!_next|static|favicon.ico|api/blocked|blocked|api/get-rooms|api/track-page-view|monitoring).*)',
  ],
};
