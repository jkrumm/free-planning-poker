import { Elysia, t } from 'elysia'
import { historyRoutes } from './history.ts'
import { type RoomsApi, roomRoutes } from './rooms.ts'
import { type StatsApi, statsRoutes } from './stats.ts'

export type BuildInfo = {
  readonly version: string
  readonly commit: string
}

/**
 * `degraded`: Postgres is away; rooms play on from memory and their writes wait. `draining`: the process got SIGTERM and
 * hands its rooms on, answered 503 so the proxy stops routing here (docs/v9/ARCHITECTURE.md, Server).
 */
export type Health = 'ok' | 'degraded' | 'draining'

/** The HTTP API under `/api`. Everything it needs arrives as an argument; it reads no environment. */
export function createApp(deps: {
  readonly build: BuildInfo
  readonly rooms: RoomsApi
  readonly stats: StatsApi
  readonly health: () => Promise<Health>
}) {
  return new Elysia({ prefix: '/api' })
    .get(
      '/health',
      {
        response: {
          200: t.Object({ status: t.Union([t.Literal('ok'), t.Literal('degraded')]) }),
          503: t.Object({ status: t.Literal('draining') }),
        },
      },
      async ({ status }) => {
        const health = await deps.health()
        if (health === 'draining') return status(503, { status: health })
        return status(200, { status: health })
      },
    )
    .get('/version', { response: t.Object({ version: t.String(), commit: t.String() }) }, () => ({
      version: deps.build.version,
      commit: deps.build.commit,
    }))
    .use(roomRoutes(deps.rooms))
    .use(historyRoutes(deps.rooms))
    .use(statsRoutes(deps.stats))
}

/** The API's type for Eden (`treaty<App>`): what a client imports from `@fpp/api/app`, types only. */
export type App = ReturnType<typeof createApp>
