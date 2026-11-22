/**
 * Every name telemetry carries, in one place (rule `telemetry.md`): the services, the resource attributes, the
 * attributes, the log events, the metrics and the spans. A name written as a string anywhere else is refused by
 * `packages/telemetry/test/names.test.ts`. Pure data: the OpenTelemetry libraries are imported by the facades.
 */

/** The estate's service names, registered in the vps repo's `observability/services.yaml` by the row that first emits one. */
export const SERVICE = {
  api: 'fpp-api',
  room: 'fpp-room',
  site: 'fpp-site',
} as const
export type ServiceName = (typeof SERVICE)[keyof typeof SERVICE]

/** The resource attributes of the estate's telemetry contract (vps docs/observability.md, Telemetry contract). */
export const RESOURCE = {
  SERVICE_NAME: 'service.name',
  SERVICE_NAMESPACE: 'service.namespace',
  SERVICE_VERSION: 'service.version',
  ENVIRONMENT: 'deployment.environment.name',
} as const

/** Groups the three services as one app in ClickStack. */
export const NAMESPACE = 'free-planning-poker'

export type Environment = 'prod' | 'dev'

/**
 * The attribute keys of spans, log records and metric labels. A value is a number, a boolean or an enum from a closed
 * set: never a vote value, a display name, a room name or slug, a topic title, a tracker key or an access code
 * (invariant 11). A room is its numeric id, a seat its index.
 */
export const ATTR = {
  /** The build the API reports in `welcome`: the one label every metric carries. */
  BUILD: 'fpp.build',
  COMMAND_TYPE: 'fpp.command.type',
  COMMAND_OUTCOME: 'fpp.command.outcome',
  NACK_REASON: 'fpp.nack.reason',
  ROOM_ID: 'fpp.room.id',
  SEAT_INDEX: 'fpp.seat.index',
  CLOSE_CODE: 'fpp.ws.close_code',
  COMPONENT: 'fpp.component',
  ACTION: 'fpp.action',
  SEVERITY: 'fpp.severity',
  EVENT_NAME: 'event.name',
  EXCEPTION_TYPE: 'exception.type',
  EXCEPTION_STACKTRACE: 'exception.stacktrace',
} as const
export type AttrKey = (typeof ATTR)[keyof typeof ATTR]

/** Where an error was caught and how bad it is: the severity tree of docs/observability.md carries over. */
export const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
export type Severity = (typeof SEVERITIES)[number]

export const COMMAND_OUTCOMES = ['ack', 'nack', 'internal'] as const
export type CommandOutcomeName = (typeof COMMAND_OUTCOMES)[number]

/** Log-based domain events: records with `event.name`, emitted by the adapter from the runtime's output. */
export const EVENT = {
  ROOM_LOADED: 'fpp.room.loaded',
  ROOM_RELEASED: 'fpp.room.released',
  ROOM_LOST: 'fpp.room.lost',
  ROUND_REVEALED: 'fpp.round.revealed',
} as const
export type EventName = (typeof EVENT)[keyof typeof EVENT]

export const SPAN = {
  /** One per command, continued from the frame's `traceparent` when it has one. */
  COMMAND: 'fpp.command',
} as const

type MetricDef = { readonly name: string; readonly unit: string; readonly description: string }

/** The server metrics of docs/v9/ARCHITECTURE.md, Measurement. Labels: `build` and the enums listed per metric. */
export const METRIC = {
  CONNECTIONS_ACTIVE: {
    name: 'fpp.ws.connections.active',
    unit: '{connection}',
    description: 'Open room sockets',
  },
  ROOMS_ACTIVE: {
    name: 'fpp.room.active',
    unit: '{room}',
    description: 'Rooms loaded in this process',
  },
  ROOM_SEATS: {
    name: 'fpp.room.seats',
    unit: '{seat}',
    description: 'Seats at the table when a room leaves this process',
  },
  COMMAND_DURATION: {
    name: 'fpp.command.duration',
    unit: 'ms',
    description: 'A command from its frame to its answer and fan-out',
  },
  FANOUT_DURATION: {
    name: 'fpp.fanout.duration',
    unit: 'ms',
    description: 'Publishing one event to the room',
  },
  WS_CLOSED: {
    name: 'fpp.ws.closed',
    unit: '{socket}',
    description: 'Sockets the runtime closed, by close code',
  },
  WS_RESUMED: {
    name: 'fpp.ws.resumed',
    unit: '{socket}',
    description: 'Sockets that came back with their seat token',
  },
  HANDOFF_DURATION: {
    name: 'fpp.deploy.handoff.duration',
    unit: 'ms',
    description: 'Draining this process: sockets closed and rooms written',
  },
  COMMAND_REJECTED: {
    name: 'fpp.command.rejected',
    unit: '{command}',
    description: 'Commands refused, by reason',
  },
  NUMBERS_EXHAUSTED: {
    name: 'fpp.room.numbers_exhausted',
    unit: '{request}',
    description: 'New rooms refused because no drawn number could be taken',
  },
} as const satisfies Record<string, MetricDef>

/** What each metric may carry besides nothing: a view drops every other attribute before export. */
export const METRIC_LABELS = {
  [METRIC.CONNECTIONS_ACTIVE.name]: [ATTR.BUILD],
  [METRIC.ROOMS_ACTIVE.name]: [ATTR.BUILD],
  [METRIC.ROOM_SEATS.name]: [ATTR.BUILD],
  [METRIC.COMMAND_DURATION.name]: [ATTR.BUILD, ATTR.COMMAND_TYPE, ATTR.COMMAND_OUTCOME],
  [METRIC.FANOUT_DURATION.name]: [ATTR.BUILD],
  [METRIC.WS_CLOSED.name]: [ATTR.BUILD, ATTR.CLOSE_CODE],
  [METRIC.WS_RESUMED.name]: [ATTR.BUILD],
  [METRIC.HANDOFF_DURATION.name]: [ATTR.BUILD],
  [METRIC.COMMAND_REJECTED.name]: [ATTR.BUILD, ATTR.NACK_REASON],
  [METRIC.NUMBERS_EXHAUSTED.name]: [ATTR.BUILD],
} as const satisfies Record<string, readonly AttrKey[]>
