import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1, { error: 'Database URL is required' }),
    VERCEL_GIT_COMMIT_SHA: z.string(),
    ANALYTICS_SECRET_TOKEN: z.string().min(1),
    BEA_SECRET_KEY: z.string().min(1),
    BEA_BASE_URL: z.string().min(1),
    ANALYTICS_URL: z.string().url({ error: 'Invalid Analytics URL' }),
    TODOIST_SECRET: z.string().min(1),
    FPP_SERVER_SECRET: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_NODE_ENV: z.enum(['development', 'test', 'production']),
    NEXT_PUBLIC_API_ROOT: z.enum([
      'http://localhost:7720/',
      'https://fpp.test/',
      'https://free-planning-poker.com/',
    ]),
    NEXT_PUBLIC_FPP_SERVER_URL: z.string().min(1),
    NEXT_PUBLIC_HYPERDX_API_KEY: z.string().min(1),
    NEXT_PUBLIC_HYPERDX_URL: z.string().url({ error: 'Invalid HyperDX URL' }),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_API_ROOT: process.env.NEXT_PUBLIC_API_ROOT,
    ANALYTICS_SECRET_TOKEN: process.env.ANALYTICS_SECRET_TOKEN,
    ANALYTICS_URL: process.env.ANALYTICS_URL,
    BEA_SECRET_KEY: process.env.BEA_SECRET_KEY,
    BEA_BASE_URL: process.env.BEA_BASE_URL,
    TODOIST_SECRET: process.env.TODOIST_SECRET,
    FPP_SERVER_SECRET: process.env.FPP_SERVER_SECRET,
    NEXT_PUBLIC_FPP_SERVER_URL: process.env.NEXT_PUBLIC_FPP_SERVER_URL,
    NEXT_PUBLIC_HYPERDX_API_KEY: process.env.NEXT_PUBLIC_HYPERDX_API_KEY,
    NEXT_PUBLIC_HYPERDX_URL: process.env.NEXT_PUBLIC_HYPERDX_URL,
  },
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === 'lint',
  emptyStringAsUndefined: true,
});
