// Browser-side OTEL: @hyperdx/browser wraps web SDK + session replay +
// Web Vitals + React error boundary attachment, and injects W3C
// traceparent into fetches matching tracePropagationTargets.
import HyperDX from '@hyperdx/browser';

import { env } from 'fpp/env';

// fpp doesn't collect PII — users are anonymous nanoid(21) IDs, no auth, no
// email/IP/headers ever attached to spans. `advancedNetworkCapture: true`
// captures request/response bodies & headers, which is safe in this app's
// data model and useful for debugging WS payload issues.
if (env.NEXT_PUBLIC_NODE_ENV !== 'development') {
  HyperDX.init({
    apiKey: env.NEXT_PUBLIC_HYPERDX_API_KEY,
    service: 'free-planning-poker',
    tracePropagationTargets: [
      /\/api\/trpc/,
      // Escape regex metacharacters from the runtime URL so e.g. dots only
      // match literal dots, not any character.
      new RegExp(
        env.NEXT_PUBLIC_FPP_SERVER_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      ),
    ],
    consoleCapture: true,
    advancedNetworkCapture: true,
  });
}

// Global error handlers — HyperDX hooks window error/unhandledrejection
// internally, but we keep a thin layer for parity with the prior setup.
if (typeof window !== 'undefined' && env.NEXT_PUBLIC_NODE_ENV !== 'development') {
  window.addEventListener('unhandledrejection', (event) => {
    HyperDX.recordException(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
    );
  });
  window.addEventListener('error', (event) => {
    if (event.error) HyperDX.recordException(event.error);
  });
}
