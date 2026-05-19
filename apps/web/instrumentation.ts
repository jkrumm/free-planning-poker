// Next.js instrumentation hook — runs once when the server boots.
// Wires @vercel/otel for traces and a LoggerProvider for OTEL log records.
// Edge runtime: no-op (OTLP HTTP exporter pulls Node-only deps).
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { registerOTel } from '@vercel/otel';

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
  const headers = parseOtelHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

  const resource = resourceFromAttributes({
    'service.name': process.env.OTEL_SERVICE_NAME ?? 'free-planning-poker',
    'service.version': process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  });

  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'free-planning-poker',
    attributes: {
      'service.version': process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    },
    traceExporter: 'auto',
  });

  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({ url: `${endpoint}/v1/logs`, headers }),
      ),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);
}

function parseOtelHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    // Split on the FIRST `=` only — header values can legitimately contain
    // additional `=` characters (e.g. base64 padding in bearer tokens).
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const key = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (key && value) out[key] = value;
  }
  return out;
}
