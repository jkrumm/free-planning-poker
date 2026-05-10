/** @type {import("prettier").Config} */
const config = {
  // Match root prettier.config.cjs — kept inline to avoid cross-config require chains
  // that confuse tsc with checkJs in the apps/web tsconfig.
  singleQuote: true,
  trailingComma: 'all',
  plugins: [
    require.resolve('prettier-plugin-tailwindcss'),
    '@trivago/prettier-plugin-sort-imports',
  ],
  // @ts-ignore
  importOrder: [
    '^react(.*)$',
    '^(next(\\/.*)?)$',
    '^fpp/env(.*)$',
    '^@trpc(.*)$',
    '^(@mantine|geist)(.*)$',
    '^normalize(.*)$',
    '^fpp/styles(.*)$',
    '<THIRD_PARTY_MODULES>',
    '^(fpp/constants)/(.*)$',
    '^(fpp/utils)/(.*)$',
    '^(fpp/store)/(.*)$',
    '^(fpp/server/api|fpp/server/db)(.*)$',
    '^(fpp/server/room-state)/(.*)$',
    '^(fpp/hooks)/(.*)$',
    '^(fpp/layout)/(.*)$',
    '^(fpp/pages)/(.*)$',
    '^(fpp/components)/(.*)$',
    '^[./]',
    '^[../]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};

module.exports = config;
