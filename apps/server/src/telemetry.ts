// OpenTelemetry bootstrap for the fpp-server WebSocket service.
// Mirrors the Argo pattern: pure OTEL SDK, no @hyperdx/* wrapper, exporters
// pointed at the unauthed :4319 receiver on the ClickStack monitoring-net
// bridge in prod and at localhost:4319 in dev.
import {
  type Attributes,
  type Tracer,
  type TracerProvider,
  metrics as metricsApi,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { SeverityNumber, logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { METRIC } from '@fpp/shared/telemetry';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'fpp-server';
const SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION ?? 'local';
const ENVIRONMENT = process.env.NODE_ENV ?? 'development';
const BASE_URL =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4319';

const resource = resourceFromAttributes({
  'service.name': SERVICE_NAME,
  // Groups the three fpp services as one app in HyperDX.
  'service.namespace': 'free-planning-poker',
  'service.version': SERVICE_VERSION,
  'deployment.environment': ENVIRONMENT,
});

const spanProcessors = [
  new BatchSpanProcessor(
    new OTLPTraceExporter({ url: `${BASE_URL}/v1/traces` }),
  ),
];

const loggerProvider = new LoggerProvider({
  resource,
  processors: [
    new BatchLogRecordProcessor(
      new OTLPLogExporter({ url: `${BASE_URL}/v1/logs` }),
    ),
  ],
});
logs.setGlobalLoggerProvider(loggerProvider);

// Standalone MeterProvider — mirrors the LoggerProvider pattern (the Elysia
// plugin only handles spans; we own logs + metrics). Instruments are bound to
// THIS provider's meter (not the global) so they always export via our reader
// regardless of what touches the global meter provider. fpp-server is the
// authoritative owner of room state, so it owns all metrics (spec §5/§8).
const meterProvider = new MeterProvider({
  resource,
  readers: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${BASE_URL}/v1/metrics` }),
      exportIntervalMillis: 60_000,
    }),
  ],
});
metricsApi.setGlobalMeterProvider(meterProvider);

const meter = meterProvider.getMeter(SERVICE_NAME);

/**
 * Typed metric handles, instantiated once from the shared METRIC registry.
 * Synchronous instruments fired at the state-mutation chokepoints
 * (room.entity / room.state) and in the action RED wrapper (instrumentAction).
 */
export const metrics = {
  actionCount: meter.createCounter(METRIC.ACTION_COUNT.name, {
    unit: METRIC.ACTION_COUNT.unit,
  }),
  actionDuration: meter.createHistogram(METRIC.ACTION_DURATION.name, {
    unit: METRIC.ACTION_DURATION.unit,
  }),
  voteCast: meter.createCounter(METRIC.VOTE_CAST.name, {
    unit: METRIC.VOTE_CAST.unit,
  }),
  roundFlipped: meter.createCounter(METRIC.ROUND_FLIPPED.name, {
    unit: METRIC.ROUND_FLIPPED.unit,
  }),
  roomCreated: meter.createCounter(METRIC.ROOM_CREATED.name, {
    unit: METRIC.ROOM_CREATED.unit,
  }),
  roomClosed: meter.createCounter(METRIC.ROOM_CLOSED.name, {
    unit: METRIC.ROOM_CLOSED.unit,
  }),
};

// Concurrency gauges — ObservableUpDownCounters whose async callbacks sample
// the authoritative roomState Maps each collection cycle. No manual ±1, so a
// missed decrement on a crash/kick/sweep path can't orphan a series (spec §8).
const userActive = meter.createObservableUpDownCounter(
  METRIC.USER_ACTIVE.name,
  {
    unit: METRIC.USER_ACTIVE.unit,
  },
);
const roomActive = meter.createObservableUpDownCounter(
  METRIC.ROOM_ACTIVE.name,
  {
    unit: METRIC.ROOM_ACTIVE.unit,
  },
);
const connectionActive = meter.createObservableUpDownCounter(
  METRIC.CONNECTION_ACTIVE.name,
  { unit: METRIC.CONNECTION_ACTIVE.unit },
);

/**
 * Wire the three concurrency gauges to live roomState accessors. Called once at
 * startup after RoomState exists (the Maps don't exist at module-load time).
 */
export function registerActiveGauges(sample: {
  users: () => number;
  rooms: () => number;
  connections: () => number;
}): void {
  userActive.addCallback((result) => result.observe(sample.users()));
  roomActive.addCallback((result) => result.observe(sample.rooms()));
  connectionActive.addCallback((result) =>
    result.observe(sample.connections()),
  );
}

export const telemetryConfig = {
  serviceName: SERVICE_NAME,
  resource,
  spanProcessors,
};

export const tracer: Tracer = trace.getTracer(SERVICE_NAME);
export const otelLogger = logs.getLogger(SERVICE_NAME);
export { SpanStatusCode };

export async function shutdownTelemetry(timeoutMs = 2000): Promise<void> {
  try {
    const tracerProvider = trace.getTracerProvider() as TracerProvider & {
      forceFlush?: (timeoutMs?: number) => Promise<void>;
    };
    const flushes: Promise<unknown>[] = [
      loggerProvider.forceFlush(),
      meterProvider.forceFlush(),
    ];
    if (typeof tracerProvider.forceFlush === 'function') {
      flushes.push(tracerProvider.forceFlush(timeoutMs));
    }
    await Promise.race([
      Promise.all(flushes),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    // best-effort flush — never block shutdown
  }
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const SEVERITY_MAP: Record<LogLevel, { number: SeverityNumber; text: string }> =
  {
    debug: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
    info: { number: SeverityNumber.INFO, text: 'INFO' },
    warn: { number: SeverityNumber.WARN, text: 'WARN' },
    error: { number: SeverityNumber.ERROR, text: 'ERROR' },
  };

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function emit(level: LogLevel, body: string, attributes?: Attributes): void {
  const { number, text } = SEVERITY_MAP[level];
  otelLogger.emit({
    severityNumber: number,
    severityText: text,
    body,
    attributes: attributes ?? {},
  });
}

// Structured logger that emits OTEL log records correlated with the active
// trace. Mirrors Argo's `log` helper. Use for non-error info/warn flows.
export const otelLog = {
  debug(message: string, attributes?: Attributes): void {
    emit('debug', message, attributes);
  },
  info(message: string, attributes?: Attributes): void {
    emit('info', message, attributes);
  },
  warn(message: string, attributes?: Attributes): void {
    emit('warn', message, attributes);
  },
  error(message: string, err?: unknown, attributes?: Attributes): void {
    const errAttrs: Attributes =
      err instanceof Error
        ? {
            'exception.type': err.name,
            'exception.message': err.message,
            'exception.stacktrace': err.stack ?? '',
          }
        : err !== undefined
          ? { 'exception.message': safeStringify(err) }
          : {};
    emit('error', message, { ...errAttrs, ...attributes });
  },
};
