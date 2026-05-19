// W3C-injecting fetch wrapper. Bun uses native fetch (not undici), so
// @opentelemetry/instrumentation-undici does not fire — manual propagation
// is the only path to trace continuity into the Next.js tRPC handler.
import {
  type Span,
  SpanKind,
  SpanStatusCode,
  context,
  propagation,
} from '@opentelemetry/api';

import { tracer } from '../telemetry';

export async function tracedFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const method =
    init?.method ?? (input instanceof Request ? input.method : 'GET');
  const parsed = (() => {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  })();

  return tracer.startActiveSpan(
    `${method} ${parsed?.hostname ?? 'unknown'}${parsed?.pathname ?? ''}`,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        'http.request.method': method,
        'url.full': url,
        ...(parsed && {
          'server.address': parsed.hostname,
          'url.scheme': parsed.protocol.replace(':', ''),
        }),
      },
    },
    async (span: Span) => {
      const headers: Record<string, string> = {};
      const existing = init?.headers;
      if (existing) {
        if (existing instanceof Headers) {
          existing.forEach((v, k) => (headers[k] = v));
        } else if (Array.isArray(existing)) {
          for (const [k, v] of existing) {
            if (k !== undefined && v !== undefined) headers[k] = v;
          }
        } else {
          Object.assign(headers, existing);
        }
      }
      propagation.inject(context.active(), headers);

      try {
        const res = await fetch(input, { ...init, headers });
        span.setAttribute('http.response.status_code', res.status);
        if (res.status >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.status}`,
          });
        }
        return res;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: String(err),
        });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}
