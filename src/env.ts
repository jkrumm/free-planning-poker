import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  // server-side environment variables schema ensures the app isn't built with invalid env vars.
  server: {
    // DATABASE_URL: z.string().url(),
    DATABASE_URL: z.string(),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    NEXT_PUBLIC_NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    NEXT_PUBLIC_API_ROOT: z.enum([
      'http://localhost:3001/',
      'https://free-planning-poker.com/',
    ]),
    VERCEL_GIT_COMMIT_SHA: z.string(),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
    ANALYTICS_SECRET_TOKEN: z.string(),
    UPTIME_SECRET_TOKEN: z.string(),
    BEA_SECRET_KEY: z.string(),
    BEA_BASE_URL: z.string(),
    ANALYTICS_URL: z.string().url(),
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string(),
    TARGET_EMAIL: z.string().email(),
    SEND_EMAIL: z.string().email(),
    SEND_EMAIL_PASSWORD: z.string(),
    TODOIST_SECRET: z.string(),
    FPP_SERVER_SECRET: z.string(),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    NEXT_PUBLIC_FPP_SERVER_URL: z.string(),
  },
  // client-side environment variables schema ensures the app isn't built with invalid env vars.
  // To expose them to the client, prefix them with `NEXT_PUBLIC_`
  client: {
    NEXT_PUBLIC_NODE_ENV: z.enum(['development', 'test', 'production']),
    NEXT_PUBLIC_API_ROOT: z.enum([
      'http://localhost:3001/',
      'https://free-planning-poker.com/',
    ]),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
    NEXT_PUBLIC_FPP_SERVER_URL: z.string(),
  },
  // You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
  // middlewares) or client-side, so we need to destruct manually.
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    // DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_API_ROOT: process.env.NEXT_PUBLIC_API_ROOT,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
    ANALYTICS_SECRET_TOKEN: process.env.ANALYTICS_SECRET_TOKEN,
    UPTIME_SECRET_TOKEN: process.env.UPTIME_SECRET_TOKEN,
    ANALYTICS_URL: process.env.ANALYTICS_URL,
    BEA_SECRET_KEY: process.env.BEA_SECRET_KEY,
    BEA_BASE_URL: process.env.BEA_BASE_URL,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    TARGET_EMAIL: process.env.TARGET_EMAIL,
    SEND_EMAIL: process.env.SEND_EMAIL,
    SEND_EMAIL_PASSWORD: process.env.SEND_EMAIL_PASSWORD,
    TODOIST_SECRET: process.env.TODOIST_SECRET,
    FPP_SERVER_SECRET: process.env.FPP_SERVER_SECRET,
    NEXT_PUBLIC_FPP_SERVER_URL: process.env.NEXT_PUBLIC_FPP_SERVER_URL,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  // Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
  // This is especially useful for Docker builds.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
