/**
 * In-memory exporters for tests: what a collector would have received, as plain data, and the check that none of the
 * strings a test planted reached it (rule `telemetry.md`, the content test).
 */
import { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs'
import { AggregationTemporality, InMemoryMetricExporter } from '@opentelemetry/sdk-metrics'
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base'
import type { Exporters } from './facade.server.ts'

/** Everything exported, as JSON-able data. */
export type Exported = {
  readonly spans: readonly Record<string, unknown>[]
  readonly metrics: readonly unknown[]
  readonly logs: readonly Record<string, unknown>[]
  /** The structured lines written for warnings and errors. */
  readonly lines: readonly string[]
}

export type MemoryExporters = {
  readonly exporters: Exporters
  /** Pass as the facade's `lines`: collects the structured lines. */
  readonly line: (line: string) => void
  /** Flushes the telemetry, then returns what the collector would hold. */
  readonly exported: (telemetry: { readonly flush: () => Promise<void> }) => Promise<Exported>
}

export function memoryExporters(): MemoryExporters {
  const spans = new InMemorySpanExporter()
  const metrics = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
  const logs = new InMemoryLogRecordExporter()
  const lines: string[] = []
  return {
    exporters: { spans, metrics, logs },
    line: (line) => {
      lines.push(line)
    },
    async exported(telemetry) {
      await telemetry.flush()
      return JSON.parse(
        JSON.stringify({
          spans: spans.getFinishedSpans().map((span) => ({
            name: span.name,
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId,
            parentSpanId: span.parentSpanContext?.spanId,
            attributes: span.attributes,
            events: span.events,
            links: span.links,
            status: span.status,
            resource: span.resource.attributes,
            scope: span.instrumentationScope.name,
          })),
          metrics: metrics.getMetrics().map((batch) => ({
            resource: batch.resource.attributes,
            scopeMetrics: batch.scopeMetrics,
          })),
          logs: logs.getFinishedLogRecords().map((record) => ({
            body: record.body,
            severity: record.severityText,
            attributes: record.attributes,
            traceId: record.spanContext?.traceId,
            spanId: record.spanContext?.spanId,
            resource: record.resource.attributes,
          })),
          lines,
        }),
      ) as Exported
    },
  }
}

/** The markers found anywhere in what was exported: a key, a value, a name, a body, a line; case does not hide one. */
export function leaksIn(exported: Exported, markers: readonly string[]): string[] {
  const text = JSON.stringify(exported).toLowerCase()
  return markers.filter((marker) => text.includes(marker.toLowerCase()))
}
