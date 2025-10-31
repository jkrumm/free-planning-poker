import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  // Server-only environment variables (NOT available on client)
  server: {
    DATABASE_URL: z.string().min(1, { error: 'Database URL is required' }),
    VERCEL_GIT_COMMIT_SHA: z.string(),
    ANALYTICS_SECRET_TOKEN: z.string().min(1),
    BEA_SECRET_KEY: z.string().min(1),
    BEA_BASE_URL: z.string().min(1),
    ANALYTICS_URL: z.string().url({ error: 'Invalid Analytics URL' }),
    UPSTASH_REDIS_REST_URL: z
      .string()
      .url({ error: 'Invalid Upstash Redis URL' }),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    TARGET_EMAIL: z.string().email({ error: 'Invalid target email' }),
    SEND_EMAIL: z.string().email({ error: 'Invalid send email' }),
    SEND_EMAIL_PASSWORD: z.string().min(1),
    TODOIST_SECRET: z.string().min(1),
    FPP_SERVER_SECRET: z.string().min(1),
    SENTRY_API_KEY: z.string().min(1),
  },
  // Client variables - available on BOTH client AND server
  // Must be prefixed with NEXT_PUBLIC_
  client: {
    NEXT_PUBLIC_NODE_ENV: z.enum(['development', 'test', 'production']),
    NEXT_PUBLIC_API_ROOT: z.enum([
      'http://localhost:3001/',
      'https://free-planning-poker.com/',
    ]),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url({ error: 'Invalid Sentry DSN URL' }),
    NEXT_PUBLIC_FPP_SERVER_URL: z.string().min(1),
  },
  // You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
  // middlewares) or client-side, so we need to destruct manually.
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_API_ROOT: process.env.NEXT_PUBLIC_API_ROOT,
    ANALYTICS_SECRET_TOKEN: process.env.ANALYTICS_SECRET_TOKEN,
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
    SENTRY_API_KEY: process.env.SENTRY_API_KEY,
    NEXT_PUBLIC_FPP_SERVER_URL: process.env.NEXT_PUBLIC_FPP_SERVER_URL,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  // Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
  // This is especially useful for Docker builds and CI/CD.
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === 'lint',
  emptyStringAsUndefined: true,
});
