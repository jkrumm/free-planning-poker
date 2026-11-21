import { Elysia, t } from 'elysia'

export type BuildInfo = {
  readonly version: string
  readonly commit: string
}

/** The HTTP API under `/api`. Everything it needs arrives as an argument; it reads no environment. */
export function createApp(deps: { readonly build: BuildInfo }) {
  return new Elysia({ prefix: '/api' })
    .get('/health', { response: t.Object({ status: t.Literal('ok') }) }, () => ({
      status: 'ok' as const,
    }))
    .get('/version', { response: t.Object({ version: t.String(), commit: t.String() }) }, () => ({
      version: deps.build.version,
      commit: deps.build.commit,
    }))
}

export type App = ReturnType<typeof createApp>
