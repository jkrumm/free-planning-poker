// @ts-check

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import drizzlePlugin from 'eslint-plugin-drizzle';
import globals from 'globals';
import { dirname } from 'path';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// FlatCompat for Next.js config compatibility
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default defineConfig([
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/analytics/**',
      'fpp-server/**',
      'next.config.js',
      'tailwind.config.mjs',
      'tailwind.config.js',
      'prettier.config.cjs',
      'next-env.d.ts',
      'eslint.config.mjs',
    ],
  },

  // Base configs
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Next.js specific configs (using FlatCompat for backward compatibility)
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // Main configuration
  {
    name: 'app-config',
    files: ['**/*.{js,jsx,ts,tsx,cjs,mjs}'],

    plugins: {
      drizzle: drizzlePlugin,
    },

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
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
