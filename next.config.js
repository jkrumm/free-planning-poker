const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  reactStrictMode: true,
  i18n: {
    locales: ['en'],
    defaultLocale: 'en',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Next.js 16: `eslint` configuration no longer supported
  // Use `next lint --fix` or ESLint directly instead
  transpilePackages: ['geist'],

  // Next.js 16: Turbopack is now stable and default
  // No need to add --turbopack flag to scripts
  // Use --webpack flag if you need to opt-out

  // Next.js 16: Image configuration (if needed in future)
  // images: {
  //   minimumCacheTTL: 14400, // Default changed to 4 hours in v16
  // },
};

// Injected content via Sentry wizard below

const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Transpiles SDK to be compatible with IE11 (increases bundle size)
  transpileClientSDK: true,

  // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
  tunnelRoute: '/monitoring',

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,

  org: 'free-planning-poker',
  project: 'free-planning-poker',

  authToken: process.env.SENTRY_AUTH_TOKEN,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
