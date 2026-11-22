/**
 * `GET /api/rooms/:slug` as a lookup port. This is the one place that knows the route's JSON: `state` (`free`,
 * `held` or `released`), `access`, `name` and `createdAt` (milliseconds or an ISO 8601 string). A 404 is a free address.
 */
import type { RoomLookup } from './ports.ts'

export type FetchLike = (url: string) => Promise<{
  readonly status: number
  readonly ok: boolean
  readonly json: () => Promise<unknown>
}>

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input)

function toMillis(input: unknown): number | undefined {
  if (typeof input === 'number' && Number.isFinite(input)) return input
  if (typeof input !== 'string') return undefined
  const parsed = Date.parse(input)
  return Number.isNaN(parsed) ? undefined : parsed
}

export function httpLookup(options: { readonly origin: string; readonly fetch: FetchLike }) {
  return async (slug: string): Promise<RoomLookup> => {
    const response = await options.fetch(`${options.origin}/api/rooms/${encodeURIComponent(slug)}`)
    if (response.status === 404) return { kind: 'free' }
    if (!response.ok) throw new Error(`lookup answered ${response.status}`)
    const body = await response.json()
    if (!isRecord(body)) throw new Error('lookup answered no object')
    if (body['state'] === 'free') return { kind: 'free' }
    const createdAt = toMillis(body['createdAt'])
    if (createdAt === undefined) throw new Error('lookup answered no creation time')
    return {
      kind: 'room',
      createdAt,
      name: typeof body['name'] === 'string' ? body['name'] : null,
      access: body['access'] === 'locked' ? 'locked' : 'open',
    }
  }
}
