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
  eslint: {
    ignoreDuringBuilds: true,
  },
  swcMinify: true,
  transpilePackages: ['geist'],
  experimental: {
    // The instrumentation hook is required for Sentry to work on the serverside
    instrumentationHook: true,
  },
  /**
   * @param {import('webpack').Configuration} config
   * @param {{ isServer: boolean }} options
   */
  webpack: (config, { isServer }) => {
    if (!isServer && config.resolve) {
      // For client builds, alias room.entity to room.types to avoid Bun-specific imports
      config.resolve.alias = {
        ...config.resolve.alias,
        'fpp-server/src/room.entity': require('path').resolve(__dirname, 'fpp-server/src/room.types.ts'),
      };
    }
    return config;
  },
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
