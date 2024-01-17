import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  // server-side environment variables schema ensures the app isn't built with invalid env vars.
  server: {
    // DATABASE_URL: z.string().url(),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    NEXT_PUBLIC_NODE_ENV: z.enum(['development', 'test', 'production']),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    NEXT_PUBLIC_API_ROOT: z.enum([
      'http://localhost:3000/',
      'https://free-planning-poker.com/',
    ]),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string(),
    UPSTASH_REDIS_REST_URL_ROOM_STATE: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN_ROOM_STATE: z.string(),
    ABLY_API_KEY: z.string(),
    ABLY_API_KEY_BASE64: z.string(),
    TARGET_EMAIL: z.string().email(),
    SEND_EMAIL: z.string().email(),
    SEND_EMAIL_PASSWORD: z.string(),
    TODOIST_SECRET: z.string(),
  },
  // client-side environment variables schema ensures the app isn't built with invalid env vars.
  // To expose them to the client, prefix them with `NEXT_PUBLIC_`
  client: {
    NEXT_PUBLIC_NODE_ENV: z.enum(['development', 'test', 'production']),
    NEXT_PUBLIC_API_ROOT: z.enum([
      'http://localhost:3000/',
      'https://free-planning-poker.com/',
    ]),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
  },
  // You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
  // middlewares) or client-side so we need to destruct manually.
  runtimeEnv: {
    // DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_API_ROOT: process.env.NEXT_PUBLIC_API_ROOT,
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    UPSTASH_REDIS_REST_URL_ROOM_STATE:
      process.env.UPSTASH_REDIS_REST_URL_ROOM_STATE,
    UPSTASH_REDIS_REST_TOKEN_ROOM_STATE:
      process.env.UPSTASH_REDIS_REST_TOKEN_ROOM_STATE,
    ABLY_API_KEY: process.env.ABLY_API_KEY,
    ABLY_API_KEY_BASE64: btoa(process.env.ABLY_API_KEY || ''),
    TARGET_EMAIL: process.env.TARGET_EMAIL,
    SEND_EMAIL: process.env.SEND_EMAIL,
    SEND_EMAIL_PASSWORD: process.env.SEND_EMAIL_PASSWORD,
    TODOIST_SECRET: process.env.TODOIST_SECRET,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  // Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
  // This is especially useful for Docker builds.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
