/** The API's environment, parsed once at startup (docs/v9/ENGINEERING.md, Files and names). */
export type Env = {
  readonly port: number
  readonly version: string
  readonly commit: string
}

/** Local development listens on 7740 (docs/v9/ARCHITECTURE.md, Checks, CI and deploy). */
const DEFAULT_PORT = 7740

export function parseEnv(source: Readonly<Record<string, string | undefined>>): Env {
  const port = source.PORT === undefined || source.PORT === '' ? DEFAULT_PORT : Number(source.PORT)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`PORT must be a port number, got "${source.PORT}"`)
  }
  return {
    port,
    version: source.APP_VERSION || 'dev',
    commit: source.GIT_SHA || 'unknown',
  }
}
