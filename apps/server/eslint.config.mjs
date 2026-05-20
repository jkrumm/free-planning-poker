// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'eslint.config.mjs',
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
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

      // OTEL: telemetry primitives must only be touched inside telemetry.ts and
      // the app-error facade. Domain code goes through recordError / recordEvent
      // and the typed `metrics` handles — never the raw logs/metrics APIs.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@opentelemetry/api-logs',
              importNames: ['logs'],
              message:
                'Use recordError() / recordEvent() from utils/app-error instead of emitting OTEL logs directly.',
            },
            {
              name: '@opentelemetry/api',
              importNames: ['metrics'],
              message:
                'Create meters/instruments only in telemetry.ts; consume the typed `metrics` handles it exports.',
            },
          ],
        },
      ],
    },
  },
  // Exception: the telemetry bootstrap + facade need direct OTEL access.
  {
    name: 'otel-exceptions',
    files: ['src/telemetry.ts', 'src/utils/app-error.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
