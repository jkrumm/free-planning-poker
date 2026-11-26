// Browser-side OTEL: @hyperdx/browser wraps web SDK + session replay +
// Web Vitals + React error boundary attachment, and injects W3C
// traceparent into fetches matching tracePropagationTargets.
// The SDK records window errors and unhandled rejections itself: add no
// global listener here, it would count every error twice.
import HyperDX from '@hyperdx/browser';

import { env } from 'fpp/env';

// fpp doesn't collect PII — users are anonymous nanoid(21) IDs, no auth, no
// email/IP/headers ever attached to spans. Still, `advancedNetworkCapture` is
// off: it records request/response headers and bodies of every network call
// (session data is the largest ClickHouse table), and spans + console capture
// carry what debugging needs. Session replay stays on with all inputs masked
// (DOM structure and rendered text only, no typed values).
// Enabled in dev too: local ingest hits the self-hosted ClickStack on
// monitoring-net, zero cost.
HyperDX.init({
  apiKey: env.NEXT_PUBLIC_HYPERDX_API_KEY,
  url: env.NEXT_PUBLIC_HYPERDX_URL,
  service: 'free-planning-poker',
  // Groups the three fpp services as one app in HyperDX (parity with the
  // server/analytics resource attribute).
  // Environment is exactly 'prod' | 'dev' (estate telemetry contract).
  otelResourceAttributes: {
    'service.namespace': 'free-planning-poker',
    'service.version': env.NEXT_PUBLIC_APP_VERSION,
    'deployment.environment.name':
      env.NEXT_PUBLIC_NODE_ENV === 'production' ? 'prod' : 'dev',
  },
  tracePropagationTargets: [
    /\/api\/trpc/,
    // Escape regex metacharacters from the runtime URL so e.g. dots only
    // match literal dots, not any character.
    new RegExp(
      env.NEXT_PUBLIC_FPP_SERVER_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    ),
  ],
  consoleCapture: true,
  advancedNetworkCapture: false,
  maskAllInputs: true,
});
