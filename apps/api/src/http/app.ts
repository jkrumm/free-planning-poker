import { Elysia, t } from 'elysia'
import { type RoomsApi, roomRoutes } from './rooms.ts'

export type BuildInfo = {
  readonly version: string
  readonly commit: string
}

/** `degraded`: Postgres is away; rooms play on from memory and their writes wait (docs/v9/ARCHITECTURE.md, Server). */
export type Health = 'ok' | 'degraded'

/** The HTTP API under `/api`. Everything it needs arrives as an argument; it reads no environment. */
export function createApp(deps: {
  readonly build: BuildInfo
  readonly rooms: RoomsApi
  readonly health: () => Promise<Health>
}) {
  return new Elysia({ prefix: '/api' })
    .get(
      '/health',
      { response: t.Object({ status: t.Union([t.Literal('ok'), t.Literal('degraded')]) }) },
      async () => ({ status: await deps.health() }),
    )
    .get('/version', { response: t.Object({ version: t.String(), commit: t.String() }) }, () => ({
      version: deps.build.version,
      commit: deps.build.commit,
    }))
    .use(roomRoutes(deps.rooms))
}

/** The API's type for Eden (`treaty<App>`): what a client imports from `@fpp/api/app`, types only. */
export type App = ReturnType<typeof createApp>
