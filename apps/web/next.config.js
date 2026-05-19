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
  // Dev-only same-origin proxy for browser OTLP ingest. The browser SDK posts
  // to `${origin}/v1/{traces,logs}` and Next.js forwards to the unauthed :4319
  // receiver on the host. Avoids CORS + sidesteps the :4318 API-key auth
  // (which would require provisioning a real local ingest key for every dev).
  // In prod the SDK targets otel.jkrumm.com directly with a real API key —
  // these rewrites are gated on NODE_ENV so they never ship to Vercel.
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') return [];
    return [
      { source: '/v1/traces', destination: 'http://localhost:4319/v1/traces' },
      { source: '/v1/logs', destination: 'http://localhost:4319/v1/logs' },
    ];
  },
};

module.exports = nextConfig;
