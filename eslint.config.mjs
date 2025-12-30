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
    'fpp-analytics/**',
    'fpp-server/**',
    'next.config.js',
    'tailwind.config.mjs',
    'tailwind.config.js',
    'prettier.config.cjs',
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
    },
  },
]);
