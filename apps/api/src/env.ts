/** The API's environment, parsed once at startup (docs/v9/ENGINEERING.md, Files and names). */
export type Env = {
  readonly port: number
  readonly version: string
  readonly commit: string
  /** Origins that may open a room socket (`ALLOWED_ORIGINS`, comma-separated); local development's by default. */
  readonly origins: readonly string[]
  /** The header the edge sets to the client's address (`CLIENT_IP_HEADER`, e.g. `cf-connecting-ip`); unset in development. */
  readonly clientIpHeader: string | undefined
}

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
  return {
    port,
    version: source.APP_VERSION || 'dev',
    commit: source.GIT_SHA || 'unknown',
    origins,
    clientIpHeader: source.CLIENT_IP_HEADER?.trim().toLowerCase() || undefined,
  }
}
