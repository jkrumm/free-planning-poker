/**
 * The API's telemetry: the runtime's telemetry port mapped onto the facade of `@fpp/telemetry/server`, under the
 * service name `fpp-api` and the estate's resource attributes (docs/v9/ARCHITECTURE.md, Measurement). With no
 * `OTEL_EXPORTER_OTLP_ENDPOINT` nothing is built and nothing is exported. Every name comes from `@fpp/telemetry`.
 */
import type { RuntimeEvent, RuntimeTelemetry } from '@fpp/room-core/server'
import { EVENT, SERVICE, type EventName } from '@fpp/telemetry/names'
import { createServerTelemetry, type Exporters, type ServerTelemetry } from '@fpp/telemetry/server'
import type { Env } from './env.ts'

/** What a runtime event is called in telemetry. */
const EVENTS: Record<RuntimeEvent, EventName> = {
  room_loaded: EVENT.ROOM_LOADED,
  room_released: EVENT.ROOM_RELEASED,
  room_lost: EVENT.ROOM_LOST,
  round_revealed: EVENT.ROUND_REVEALED,
}

export type ApiTelemetry = {
  readonly server: ServerTelemetry
  /** The port the room runtime reports through. */
  readonly port: RuntimeTelemetry
}

/** The service version of the estate's contract: the short commit hash, or `local` for a build with none. */
export const versionOf = (env: Pick<Env, 'commit'>) =>
  env.commit === 'unknown' || env.commit === '' ? 'local' : env.commit.slice(0, 7)

export function createApiTelemetry(
  env: Env,
  options: {
    readonly exporters?: Exporters
    /** Where warnings and errors are written as JSON lines; stderr by default. */
    readonly lines?: (line: string) => void
  } = {},
): ApiTelemetry {
  const server = createServerTelemetry({
    service: SERVICE.api,
    version: versionOf(env),
    environment: env.environment,
    build: env.version,
    endpoint: env.otlpEndpoint,
    lines: options.lines ?? ((line) => console.error(line)),
    ...(options.exporters === undefined ? {} : { exporters: options.exporters }),
  })
  const port: RuntimeTelemetry = {
    failure: (error, { action }) =>
      server.recordError(error, { component: 'room-runtime', action }, 'high'),
    closed: server.closed,
    command: server.command,
    fanout: server.fanout,
    rejected: server.rejected,
    resumed: server.resumed,
    event: (event) => server.recordEvent(EVENTS[event]),
    roomEnded: server.roomEnded,
    handoff: server.handoff,
  }
  return { server, port }
}
