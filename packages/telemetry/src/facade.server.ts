/**
 * OpenTelemetry for a server of the estate: spans, metrics and log records under the estate's contract (resource
 * attributes `service.namespace`, `deployment.environment.name`, `service.version`). It is the only place the
 * OpenTelemetry libraries are imported (rule `telemetry.md`). With no endpoint and no exporter given it builds no SDK:
 * every call does its work and records nothing, and no export is ever attempted.
 *
 * Nothing exported carries a vote value, a display name, a room name or slug, a topic title, a tracker key or an access
 * code: attribute keys are the `ATTR` registry's, a value is a count, an enum, a numeric room id or a seat index, and an
 * error is exported by its type and its stack frames, never its message (a database error's message holds the row).
 */
import {
  context,
  defaultTextMapGetter,
  metrics as metricsApi,
  ROOT_CONTEXT,
  SpanStatusCode,
  trace,
  type Context,
  type Meter,
  type Tracer,
} from '@opentelemetry/api'
import { logs, SeverityNumber, type Logger } from '@opentelemetry/api-logs'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  SimpleLogRecordProcessor,
  type LogRecordExporter,
} from '@opentelemetry/sdk-logs'
import {
  createAllowListAttributesProcessor,
  MeterProvider,
  PeriodicExportingMetricReader,
  type PushMetricExporter,
} from '@opentelemetry/sdk-metrics'
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  SimpleSpanProcessor,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base'
import {
  ATTR,
  EVENT,
  METRIC,
  METRIC_LABELS,
  NAMESPACE,
  RESOURCE,
  SPAN,
  type AttrKey,
  type Environment,
  type EventName,
  type ServiceName,
  type Severity,
} from './names.ts'

export type Exporters = {
  readonly spans: SpanExporter
  readonly metrics: PushMetricExporter
  readonly logs: LogRecordExporter
}

export type ServerTelemetryConfig = {
  readonly service: ServiceName
  /** The short commit hash, or `local`. */
  readonly version: string
  readonly environment: Environment
  /** The build the server reports to clients: the label of every metric. */
  readonly build: string
  /** The collector's base URL (`OTEL_EXPORTER_OTLP_ENDPOINT`); absent means no SDK and no export. */
  readonly endpoint: string | undefined
  /** One structured JSON line per warning or error, with the trace ids: the operator's view without a collector. */
  readonly lines?: (line: string) => void
  /** Exporters to use in place of the collector's: tests give in-memory ones. */
  readonly exporters?: Exporters
}

/** A value a record may carry: a number, a boolean or an enum, under a key of the registry. */
export type Attrs = Partial<Record<AttrKey, string | number | boolean>>

export type CommandSpan = {
  readonly type: string
  /** The room's numeric id. */
  readonly room: string
  readonly seat: number
  readonly traceparent: string | undefined
}

export type CommandResult = { readonly ok: true } | { readonly ok: false; readonly reason: string }

export type ServerTelemetry = {
  readonly exporting: boolean
  /** Runs one command inside its span, continued from the frame's `traceparent`; times it and counts a refusal. */
  readonly command: (info: CommandSpan, run: () => CommandResult) => void
  readonly fanout: (run: () => void) => void
  readonly rejected: (reason: string) => void
  readonly closed: (code: number) => void
  readonly resumed: () => void
  readonly roomEnded: (seats: number) => void
  readonly handoff: (ms: number) => void
  /** Wires the two gauges to what the process holds now; sampled at each collection. */
  readonly observeLoad: (
    sample: () => { readonly connections: number; readonly rooms: number },
  ) => void
  /** Captures an exception once, at a boundary; a user mistake or a business conflict is no error. */
  readonly recordError: (
    error: unknown,
    at: { readonly component: string; readonly action: string },
    severity: Severity,
  ) => void
  /** A log-based domain event, typed by the registry. */
  readonly recordEvent: (name: EventName, attrs?: Attrs) => void
  /** Exports what is buffered. */
  readonly flush: () => Promise<void>
  /** Exports what is buffered and stops, never waiting longer than `timeoutMs`. */
  readonly shutdown: (timeoutMs?: number) => Promise<void>
}

const SEVERITY = {
  low: { number: SeverityNumber.INFO, text: 'INFO' },
  medium: { number: SeverityNumber.WARN, text: 'WARN' },
  high: { number: SeverityNumber.ERROR, text: 'ERROR' },
  critical: { number: SeverityNumber.FATAL, text: 'FATAL' },
} as const satisfies Record<Severity, { number: SeverityNumber; text: string }>

const WARNING_EVENTS: ReadonlySet<EventName> = new Set([EVENT.ROOM_LOST])

const MS_BUCKETS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500]
const SEAT_BUCKETS = [1, 2, 3, 5, 8, 10, 15, 20]

function otlp(endpoint: string): Exporters {
  const base = endpoint.replace(/\/+$/, '')
  return {
    spans: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    metrics: new OTLPMetricExporter({ url: `${base}/v1/metrics` }),
    logs: new OTLPLogExporter({ url: `${base}/v1/logs` }),
  }
}

type Sdk = {
  readonly tracer: Tracer
  readonly meter: Meter
  readonly logger: Logger
  readonly flush: () => Promise<void>
  readonly stop: () => Promise<void>
}

function startSdk(config: ServerTelemetryConfig, exporters: Exporters, simple: boolean): Sdk {
  const resource = resourceFromAttributes({
    [RESOURCE.SERVICE_NAME]: config.service,
    [RESOURCE.SERVICE_NAMESPACE]: NAMESPACE,
    [RESOURCE.SERVICE_VERSION]: config.version,
    [RESOURCE.ENVIRONMENT]: config.environment,
  })
  const tracerProvider = new BasicTracerProvider({
    resource,
    spanProcessors: [
      simple ? new SimpleSpanProcessor(exporters.spans) : new BatchSpanProcessor(exporters.spans),
    ],
  })
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      simple
        ? new SimpleLogRecordProcessor({ exporter: exporters.logs })
        : new BatchLogRecordProcessor({ exporter: exporters.logs }),
    ],
  })
  // A view drops every attribute a metric does not list before export: a stray label cannot reach a series.
  const meterProvider = new MeterProvider({
    resource,
    views: Object.entries(METRIC_LABELS).map(([instrumentName, keys]) => ({
      instrumentName,
      attributesProcessors: [createAllowListAttributesProcessor([...keys])],
    })),
    readers: [
      new PeriodicExportingMetricReader({
        exporter: exporters.metrics,
        exportIntervalMillis: simple ? 3_600_000 : 60_000,
      }),
    ],
  })
  return {
    tracer: tracerProvider.getTracer(config.service),
    meter: meterProvider.getMeter(config.service),
    logger: loggerProvider.getLogger(config.service),
    flush: async () => {
      await Promise.all([
        tracerProvider.forceFlush(),
        meterProvider.forceFlush(),
        loggerProvider.forceFlush(),
      ])
    },
    stop: async () => {
      await Promise.all([
        tracerProvider.shutdown(),
        meterProvider.shutdown(),
        loggerProvider.shutdown(),
      ])
    },
  }
}

/** Frames of a stack, without its first line: that line is the error's message. */
const framesOf = (error: Error): string =>
  (error.stack ?? '')
    .split('\n')
    .filter((line) => /^\s+at /.test(line))
    .join('\n')

const propagator = new W3CTraceContextPropagator()

export function createServerTelemetry(config: ServerTelemetryConfig): ServerTelemetry {
  const exporters = config.exporters ?? (config.endpoint ? otlp(config.endpoint) : undefined)
  const sdk =
    exporters === undefined
      ? undefined
      : startSdk(config, exporters, config.exporters !== undefined)
  // Without an SDK these are the API's no-ops: nothing is recorded and nothing is exported.
  const tracer = sdk?.tracer ?? trace.getTracer(config.service)
  const meter = sdk?.meter ?? metricsApi.getMeter(config.service)
  const logger = sdk?.logger ?? logs.getLogger(config.service)
  const label = { [ATTR.BUILD]: config.build }

  const commandDuration = meter.createHistogram(METRIC.COMMAND_DURATION.name, {
    unit: METRIC.COMMAND_DURATION.unit,
    description: METRIC.COMMAND_DURATION.description,
    advice: { explicitBucketBoundaries: MS_BUCKETS },
  })
  const fanoutDuration = meter.createHistogram(METRIC.FANOUT_DURATION.name, {
    unit: METRIC.FANOUT_DURATION.unit,
    description: METRIC.FANOUT_DURATION.description,
    advice: { explicitBucketBoundaries: MS_BUCKETS },
  })
  const handoffDuration = meter.createHistogram(METRIC.HANDOFF_DURATION.name, {
    unit: METRIC.HANDOFF_DURATION.unit,
    description: METRIC.HANDOFF_DURATION.description,
    advice: { explicitBucketBoundaries: [100, 500, 1000, 2500, 5000, 10000, 20000] },
  })
  const roomSeats = meter.createHistogram(METRIC.ROOM_SEATS.name, {
    unit: METRIC.ROOM_SEATS.unit,
    description: METRIC.ROOM_SEATS.description,
    advice: { explicitBucketBoundaries: SEAT_BUCKETS },
  })
  const rejected = meter.createCounter(METRIC.COMMAND_REJECTED.name, {
    unit: METRIC.COMMAND_REJECTED.unit,
    description: METRIC.COMMAND_REJECTED.description,
  })
  const closed = meter.createCounter(METRIC.WS_CLOSED.name, {
    unit: METRIC.WS_CLOSED.unit,
    description: METRIC.WS_CLOSED.description,
  })
  const resumed = meter.createCounter(METRIC.WS_RESUMED.name, {
    unit: METRIC.WS_RESUMED.unit,
    description: METRIC.WS_RESUMED.description,
  })
  const connections = meter.createObservableUpDownCounter(METRIC.CONNECTIONS_ACTIVE.name, {
    unit: METRIC.CONNECTIONS_ACTIVE.unit,
    description: METRIC.CONNECTIONS_ACTIVE.description,
  })
  const rooms = meter.createObservableUpDownCounter(METRIC.ROOMS_ACTIVE.name, {
    unit: METRIC.ROOMS_ACTIVE.unit,
    description: METRIC.ROOMS_ACTIVE.description,
  })

  /** The context of the command being run: the room loop is synchronous, so one variable holds it. */
  let active: Context | undefined

  function emit(
    severity: Severity,
    body: string,
    attributes: Record<string, string | number | boolean>,
  ) {
    const { number, text } = SEVERITY[severity]
    const at = active ?? context.active()
    logger.emit({ severityNumber: number, severityText: text, body, attributes, context: at })
    if (config.lines === undefined || number < SeverityNumber.WARN) return
    const span = trace.getSpanContext(at)
    config.lines(
      JSON.stringify({
        time: new Date().toISOString(),
        level: text.toLowerCase(),
        service: config.service,
        msg: body,
        ...(span === undefined ? {} : { trace_id: span.traceId, span_id: span.spanId }),
        ...attributes,
      }),
    )
  }

  function command(info: CommandSpan, run: () => CommandResult) {
    // Without an SDK there is nothing to continue or time: the command runs as it is.
    if (sdk === undefined) return void run()
    const parent =
      info.traceparent === undefined
        ? ROOT_CONTEXT
        : propagator.extract(ROOT_CONTEXT, { traceparent: info.traceparent }, defaultTextMapGetter)
    const span = tracer.startSpan(
      SPAN.COMMAND,
      {
        attributes: {
          ...label,
          [ATTR.COMMAND_TYPE]: info.type,
          [ATTR.ROOM_ID]: info.room,
          [ATTR.SEAT_INDEX]: info.seat,
        },
      },
      parent,
    )
    const outer = active
    active = trace.setSpan(parent, span)
    const began = performance.now()
    let outcome = 'internal'
    try {
      const result = run()
      outcome = result.ok ? 'ack' : result.reason === 'internal' ? 'internal' : 'nack'
      if (!result.ok) {
        span.setAttribute(ATTR.NACK_REASON, result.reason)
        if (result.reason !== 'internal')
          rejected.add(1, { ...label, [ATTR.NACK_REASON]: result.reason })
      }
    } finally {
      active = outer
      span.setAttribute(ATTR.COMMAND_OUTCOME, outcome)
      if (outcome === 'internal') span.setStatus({ code: SpanStatusCode.ERROR })
      span.end()
      commandDuration.record(performance.now() - began, {
        ...label,
        [ATTR.COMMAND_TYPE]: info.type,
        [ATTR.COMMAND_OUTCOME]: outcome,
      })
    }
  }

  return {
    exporting: sdk !== undefined,
    command,
    fanout(run) {
      const began = performance.now()
      try {
        run()
      } finally {
        fanoutDuration.record(performance.now() - began, label)
      }
    },
    rejected: (reason) => rejected.add(1, { ...label, [ATTR.NACK_REASON]: reason }),
    closed: (code) => closed.add(1, { ...label, [ATTR.CLOSE_CODE]: String(code) }),
    resumed: () => resumed.add(1, label),
    roomEnded: (seats) => roomSeats.record(seats, label),
    handoff: (ms) => handoffDuration.record(ms, label),
    observeLoad(sample) {
      connections.addCallback((result) => result.observe(sample().connections, label))
      rooms.addCallback((result) => result.observe(sample().rooms, label))
    },
    recordError(error, at, severity) {
      const attributes = {
        [ATTR.COMPONENT]: at.component,
        [ATTR.ACTION]: at.action,
        [ATTR.SEVERITY]: severity,
        [ATTR.EXCEPTION_TYPE]: error instanceof Error ? error.name : typeof error,
        ...(error instanceof Error ? { [ATTR.EXCEPTION_STACKTRACE]: framesOf(error) } : {}),
      }
      const span = trace.getSpan(active ?? context.active())
      if (span !== undefined && (severity === 'high' || severity === 'critical'))
        span.setStatus({ code: SpanStatusCode.ERROR })
      emit(severity, `${at.component} ${at.action} failed`, attributes)
    },
    recordEvent(name, attrs = {}) {
      const body = [name, ...Object.entries(attrs).map(([key, value]) => `${key}=${value}`)].join(
        ' ',
      )
      emit(WARNING_EVENTS.has(name) ? 'medium' : 'low', body, { ...attrs, [ATTR.EVENT_NAME]: name })
    },
    flush: async () => {
      await sdk?.flush()
    },
    async shutdown(timeoutMs = 2000) {
      if (sdk === undefined) return
      let timer: ReturnType<typeof setTimeout> | undefined
      const limit = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs)
      })
      try {
        // Best effort: a collector that is down never holds a shutdown.
        await Promise.race([sdk.flush().then(() => sdk.stop()), limit])
      } catch {
        // Exporting is best effort.
      } finally {
        clearTimeout(timer)
      }
    },
  }
}
