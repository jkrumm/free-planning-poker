// @ts-check
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import drizzlePlugin from 'eslint-plugin-drizzle';
import { defineConfig, globalIgnores } from 'eslint/config';
import { dirname } from 'path';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig([
  // Next.js 16: Native flat config support (no FlatCompat needed)
  ...nextCoreWebVitals,
  ...nextTypescript,

  // TypeScript recommended configs
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Global ignores - Next.js 16 approach
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/out/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/.venv/**',
    'next.config.js',
    'tailwind.config.js',
    'prettier.config.cjs',
    'scripts/**',
    'next-env.d.ts',
    'eslint.config.mjs',
    'src/hooks/useWebSocketRoom.ts',
  ]),

  // Main configuration
  {
    name: 'app-config',
    files: ['**/*.{js,jsx,ts,tsx,cjs,mjs}'],

    plugins: {
      drizzle: drizzlePlugin,
    },

    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },

    rules: {
      // TypeScript rules
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: {
            attributes: false,
          },
        },
      ],

      // React rules
      'react-hooks/exhaustive-deps': 'off',

      // Drizzle rules
      'drizzle/enforce-delete-with-where': [
        'error',
        {
          drizzleObjectName: ['db'],
        },
      ],
      'drizzle/enforce-update-with-where': [
        'error',
        {
          drizzleObjectName: ['db'],
        },
      ],

      // OTEL: Enforce the app-error facade instead of direct OTEL/HyperDX calls
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@opentelemetry/api-logs',
              importNames: ['logs'],
              message:
                'Use recordError() or recordEvent() from fpp/utils/app-error instead of emitting OTEL logs directly.',
            },
            {
              name: '@opentelemetry/api',
              importNames: ['metrics'],
              message:
                'The browser emits events, not metrics — the authoritative server owns all metrics. Do not create meters here.',
            },
            {
              name: '@hyperdx/browser',
              message:
                'Use recordError() from fpp/utils/app-error instead of @hyperdx/browser directly. Init lives in instrumentation-client.ts.',
            },
            {
              name: 'fpp/utils/logger',
              message:
                'Use log.warn()/log.info() (operator narration) or recordError()/recordEvent() from fpp/utils/app-error. The raw Pino logger only reaches stdout — on the Vercel-hosted web app stdout is not aggregated into ClickStack/HyperDX.',
            },
          ],
        },
      ],
    },
  },

  // Exception: telemetry init + the facade itself need direct access. The tRPC
  // handler is allowlisted too — it keeps a raw-Pino per-request access log that
  // is stdout-only by design (request RED is covered by @vercel/otel spans, so
  // it must not emit an OTLP record); see the import comment there.
  {
    name: 'otel-exceptions',
    files: [
      'src/utils/app-error.ts',
      'instrumentation.ts',
      'instrumentation-client.ts',
      // Glob, not the literal path: the `[trpc]` brackets in the filename are a
      // glob character class, so an exact path would never match.
      'src/pages/api/trpc/*.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]);
