import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from "next/server";
import { Ratelimit } from "@upstash/ratelimit";

import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(15, "10 s"),
  analytics: true,
});

const isAPI = (path: string) => {
  return path.match(new RegExp(`^\/api\/`));
};

export default async function middleware(
  request: NextRequest,
  event: NextFetchEvent
): Promise<Response | undefined> {
  // Allow blocked page and endpoint
  if (
    request.nextUrl.pathname === "/api/blocked" ||
    request.nextUrl.pathname === "/blocked"
  ) {
    return NextResponse.next();
  }
  const ip = request.ip ?? "127.0.0.1";

  // Rate limit apis
  if (isAPI(request.nextUrl.pathname)) {
    const { success, pending, limit, reset, remaining } = await ratelimit.limit(
      `ratelimit_middleware_${ip}`
    );
    event.waitUntil(pending);

    const res = success
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/api/blocked", request.url));

    res.headers.set("X-RateLimit-Limit", limit.toString());
    res.headers.set("X-RateLimit-Remaining", remaining.toString());
    res.headers.set("X-RateLimit-Reset", reset.toString());
    return res;
  }

  const { success, pending } = await ratelimit.limit(
    `ratelimit_middleware_${ip}`
  );
  event.waitUntil(pending);

  return success
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/blocked", request.url));
}

// Stop middleware from running on static files
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next
     * - static (static files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next|static|favicon.ico).*)",
  ],
};
