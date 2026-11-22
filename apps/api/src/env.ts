import { fileURLToPath } from 'node:url'

/** The API's environment, parsed once at startup (docs/v9/ENGINEERING.md, Files and names). */
export type Env = {
  readonly port: number
  readonly version: string
  readonly commit: string
  /** Origins that may open a room socket (`ALLOWED_ORIGINS`, comma-separated); local development's by default. */
  readonly origins: readonly string[]
  /**
   * The single-valued header the edge overwrites with the client's address (`CLIENT_IP_HEADER`, e.g.
   * `cf-connecting-ip`); unset in development. Never `x-forwarded-for`: a client writes its first entry.
   */
  readonly clientIpHeader: string | undefined
  /** The collector's base URL (`OTEL_EXPORTER_OTLP_ENDPOINT`); unset means no telemetry is exported. */
  readonly otlpEndpoint: string | undefined
  /** `prod` in production (`NODE_ENV=production`), `dev` everywhere else: the estate allows no third value. */
  readonly environment: 'prod' | 'dev'
  /** Postgres (`DATABASE_URL`): rooms, their addresses, snapshots and history. */
  readonly databaseUrl: string
  /**
   * The mail gateway behind `POST /api/contact` (`EMAIL_GATEWAY_URL`, the base URL, and `EMAIL_GATEWAY_SECRET_KEY`); unset,
   * or only one of the two, the route answers 503.
   */
  readonly emailGateway: Upstream | undefined
  /**
   * The factory's door behind `POST /api/feedback` (`FACTORY_FEEDBACK_URL`, the full URL with the app, and
   * `FACTORY_FEEDBACK_TOKEN`); unset, or only one of the two, the route answers 503.
   */
  readonly feedbackDoor: Upstream | undefined
  /** The built room app the API serves under `/room` and `/_room` (`ROOM_APP_DIR`); the build of `apps/room` by default. */
  readonly roomAppDir: string
  /**
   * Apply the migrations before serving (`MIGRATE_ON_START=true`, set by the image). Off by default: a process in
   * development or in a test starts without a database and plays on (docs/development.md, Image).
   */
  readonly migrateOnStart: boolean
  /** The drizzle migrations applied on start (`MIGRATIONS_DIR`); `apps/api/drizzle` by default, the copy beside the bundle in the image. */
  readonly migrationsDir: string
  /** The server secret of the device hash in `visitor_day` (`VISITOR_KEY`, at least 32 characters). */
  readonly visitorKey: string
}

/** Where a message goes and what proves us to it. */
export type Upstream = { readonly url: string; readonly secret: string }
/** Where `bun run build` in `apps/room` writes the app, beside the API's sources. */
const DEFAULT_ROOM_APP_DIR = fileURLToPath(new URL('../../room/dist', import.meta.url))

/** Where the migrations are in the source tree, beside `src`. */
const DEFAULT_MIGRATIONS_DIR = fileURLToPath(new URL('../drizzle', import.meta.url))

/** A shorter key than this is refused: it would make the device hash guessable. */
const VISITOR_KEY_MIN = 32

/** Local development listens on 7740 (docs/v9/ARCHITECTURE.md, Checks, CI and deploy). */
const DEFAULT_PORT = 7740

/** Local development's one host and the room app's Vite server (docs/development.md, Ports). */
const DEV_ORIGINS = ['https://fpp-next.test', 'http://localhost:7739']

/** `scheme://host[:port]` exactly as a browser sends it in `Origin`, or undefined. */
function originOf(text: string): string | undefined {
  try {
    const url = new URL(text)
    return url.origin === text ? text : undefined
  } catch {
    return undefined
  }
}

/** An upstream from its two variables: both set or it is off; a URL that is no http(s) URL is a typo, refused at startup. */
function upstreamOf(
  source: Readonly<Record<string, string | undefined>>,
  names: { readonly url: string; readonly secret: string },
): Upstream | undefined {
  const url = source[names.url]?.trim() ?? ''
  const secret = source[names.secret]?.trim() ?? ''
  if (url === '' || secret === '') return undefined
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`${names.url} must be an http(s) URL`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
    throw new Error(`${names.url} must be an http(s) URL`)
  return { url: url.replace(/\/+$/, ''), secret }
}

export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const port = source.PORT === undefined || source.PORT === '' ? DEFAULT_PORT : Number(source.PORT)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be a port number, got "${source.PORT}"`)
  }
  const listed = (source.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
  const origins = listed.length > 0 ? listed : [...DEV_ORIGINS, `http://localhost:${port}`]
  for (const origin of origins)
    if (originOf(origin) === undefined)
      throw new Error(`ALLOWED_ORIGINS must list origins like https://example.com, got "${origin}"`)
  const databaseUrl = source.DATABASE_URL?.trim() ?? ''
  if (!/^postgres(ql)?:\/\//.test(databaseUrl))
    throw new Error(
      'DATABASE_URL must be a postgres:// URL (apps/api/.env.tpl has the local value)',
    )
  const visitorKey = source.VISITOR_KEY ?? ''
  if (visitorKey.length < VISITOR_KEY_MIN)
    throw new Error(`VISITOR_KEY must have at least ${VISITOR_KEY_MIN} characters`)
  return {
    port,
    version: source.APP_VERSION || 'dev',
    commit: source.GIT_SHA || 'unknown',
    origins,
    clientIpHeader: source.CLIENT_IP_HEADER?.trim().toLowerCase() || undefined,
    otlpEndpoint: source.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || undefined,
    environment: source.NODE_ENV === 'production' ? 'prod' : 'dev',
    emailGateway: upstreamOf(source, {
      url: 'EMAIL_GATEWAY_URL',
      secret: 'EMAIL_GATEWAY_SECRET_KEY',
    }),
    feedbackDoor: upstreamOf(source, {
      url: 'FACTORY_FEEDBACK_URL',
      secret: 'FACTORY_FEEDBACK_TOKEN',
    }),
    roomAppDir: source.ROOM_APP_DIR?.trim() || DEFAULT_ROOM_APP_DIR,
    migrateOnStart: source.MIGRATE_ON_START === 'true',
    migrationsDir: source.MIGRATIONS_DIR?.trim() || DEFAULT_MIGRATIONS_DIR,
    databaseUrl,
    visitorKey,
  }
}
