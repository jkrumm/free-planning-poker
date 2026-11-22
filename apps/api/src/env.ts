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
  /** The server secret of the device hash in `visitor_day` (`VISITOR_KEY`, at least 32 characters). */
  readonly visitorKey: string
}

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
    databaseUrl,
    visitorKey,
  }
}
