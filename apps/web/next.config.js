const nextConfig = {
  reactStrictMode: true,
  i18n: {
    locales: ['en'],
    defaultLocale: 'en',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Emit .js.map files for the client bundle so @hyperdx/cli can upload them
  // post-build. Maps land in .next/static/chunks/ and are publicly served —
  // same threat model as the old hidden-then-upload Sentry flow (stack
  // traces leak either way once you ship a JS bundle).
  productionBrowserSourceMaps: true,
  // Next.js 16 dev server rejects requests whose Origin isn't the bind host.
  // Locally we proxy through Caddy as fpp.test, so whitelist it for both the
  // HMR WebSocket and the /__nextjs_original-stack-frames endpoint. No prod
  // impact — this is a dev-only check.
  allowedDevOrigins: ['fpp.test', 'localhost:7720'],
  transpilePackages: ['@fpp/db', '@fpp/shared', 'geist'],
};

module.exports = nextConfig;
