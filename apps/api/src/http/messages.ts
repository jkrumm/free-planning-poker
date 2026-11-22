/**
 * The two routes that send a message out of the room's origin (docs/v9/ARCHITECTURE.md, HTTP API): `POST /contact` to the
 * mail gateway and `POST /feedback` to the factory's door, with v1's fields and limits. What sends lives behind
 * `MessagesApi`, which the composition root implements; every refusal is a typed `{ error }` response, so nothing here
 * throws for a user mistake; a body past the server's cap (`MAX_BODY_BYTES`) is refused by Bun with its own 413 before any route runs. A body is never logged or recorded: the message text, the e-mail address and the subject
 * stay in the request (rule `telemetry.md`).
 */
import { Elysia, ParseError, t, ValidationError } from 'elysia'

/** v1's limits (`contact.router.ts`, `packages/shared/src/feedback.ts`); the site's form prints the contact ones. */
export const CONTACT_LIMITS = {
  name: { max: 50 },
  email: { max: 70 },
  subject: { min: 3, max: 100 },
  message: { max: 800 },
} as const

export const FEEDBACK_LIMITS = {
  title: { max: 200 },
  text: { max: 2000 },
  version: { max: 64 },
  route: { max: 256 },
} as const

export type ContactInput = {
  readonly name?: string
  readonly email: string
  readonly subject: string
  readonly message?: string
}

export type FeedbackInput = {
  readonly title: string
  readonly text?: string
  readonly version: string
  readonly route: string
}

/**
 * How a send ends when it was valid: `unavailable` (the route's upstream is not configured), `rate_limited` (with the
 * seconds until the client's oldest submission leaves the window) or `upstream_failed` (it refused, timed out or could
 * not be reached).
 */
export type SendResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: 'unavailable' | 'upstream_failed' }
  | { readonly ok: false; readonly error: 'rate_limited'; readonly retryAfter: number }

export type MessagesApi = {
  readonly contact: (input: ContactInput, client: string) => Promise<SendResult>
  readonly feedback: (input: FeedbackInput, client: string) => Promise<SendResult>
}

const Err = <const E extends string>(error: E) => t.Object({ error: t.Literal(error) })

const Sent = t.Object({ success: t.Literal(true) })

const Busy = Err('rate_limited')
const Down = Err('upstream_failed')
const Off = Err('unavailable')
const Foreign = Err('forbidden_origin')

const ContactBody = t.Object({
  name: t.Optional(t.String({ maxLength: CONTACT_LIMITS.name.max })),
  email: t.String({ maxLength: CONTACT_LIMITS.email.max }),
  subject: t.String({
    minLength: CONTACT_LIMITS.subject.min,
    maxLength: CONTACT_LIMITS.subject.max,
  }),
  message: t.Optional(t.String({ maxLength: CONTACT_LIMITS.message.max })),
})

const FeedbackBody = t.Object({
  title: t.String({ minLength: 1, maxLength: FEEDBACK_LIMITS.title.max }),
  text: t.Optional(t.String({ maxLength: FEEDBACK_LIMITS.text.max })),
  version: t.String({ minLength: 1, maxLength: FEEDBACK_LIMITS.version.max }),
  route: t.String({ minLength: 1, maxLength: FEEDBACK_LIMITS.route.max }),
})

const CONTACT_FIELDS = ['name', 'email', 'subject', 'message'] as const
const FEEDBACK_FIELDS = ['title', 'text', 'version', 'route'] as const

type ContactField = (typeof CONTACT_FIELDS)[number]
type FeedbackField = (typeof FEEDBACK_FIELDS)[number]

const ContactInvalid = t.Object({
  error: t.Union([
    t.Literal('invalid_name'),
    t.Literal('invalid_email'),
    t.Literal('invalid_subject'),
    t.Literal('invalid_message'),
    t.Literal('invalid_body'),
  ]),
})

const FeedbackInvalid = t.Object({
  error: t.Union([
    t.Literal('invalid_title'),
    t.Literal('invalid_text'),
    t.Literal('invalid_version'),
    t.Literal('invalid_route'),
    t.Literal('invalid_body'),
  ]),
})

/** The zod email of v1's route (Zod 4's default pattern): what v1 accepted, this accepts. */
const EMAIL =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/

/** A line break in a field that becomes a mail header or a title would let a visitor add headers. */
const LINE_BREAK = /[\r\n]/

/** The first field a failed schema names: Elysia's validation error lists its findings as paths or missing keys. */
function fieldOf<F extends string>(error: unknown, fields: readonly F[]): F | undefined {
  const found = (error as { errors?: readonly { instancePath?: string; params?: unknown }[] })
    .errors?.[0]
  if (found === undefined) return undefined
  const path = found.instancePath?.slice(1)
  const missing = (found.params as { requiredProperties?: readonly string[] } | undefined)
    ?.requiredProperties?.[0]
  return fields.find((field) => field === (path === '' || path === undefined ? missing : path))
}

type Deps = {
  readonly api: MessagesApi
  /** `ALLOWED_ORIGINS`: the one list the socket checks too. */
  readonly origins: ReadonlySet<string>
  /** The client's key for the limits: the edge's header, else the peer (`clientIp` in `ws/edge.ts`). */
  readonly client: (request: Request) => string
}

export function messageRoutes({ api, origins, client }: Deps) {
  /** Site and room share the API's origin, so there is no CORS: a request from any other origin is refused. */
  const foreign = (request: Request) => {
    const origin = request.headers.get('origin')
    return origin === null || !origins.has(origin)
  }
  return new Elysia()
    .onError(ParseError, ({ status }) => status(400, { error: 'invalid_body' }))
    .onError(ValidationError, ({ error, request, status }) => {
      const path = new URL(request.url).pathname
      if (path.endsWith('/feedback'))
        return status(400, { error: `invalid_${fieldOf(error, FEEDBACK_FIELDS) ?? 'body'}` })
      return status(400, { error: `invalid_${fieldOf(error, CONTACT_FIELDS) ?? 'body'}` })
    })
    .post(
      '/contact',
      {
        body: ContactBody,
        beforeHandle: ({ request, status }) =>
          foreign(request) ? status(403, { error: 'forbidden_origin' }) : undefined,
        response: {
          200: Sent,
          400: ContactInvalid,
          403: Foreign,
          429: Busy,
          502: Down,
          503: Off,
        },
      },
      async ({ body, request, set, status }) => {
        const invalid = invalidContact(body)
        if (invalid !== undefined) return status(400, { error: invalid })
        const result = await api.contact(body, client(request))
        if (result.ok) return status(200, { success: true })
        if (result.error === 'rate_limited') {
          set.headers['retry-after'] = String(result.retryAfter)
          return status(429, { error: result.error })
        }
        if (result.error === 'upstream_failed') return status(502, { error: result.error })
        return status(503, { error: result.error })
      },
    )
    .post(
      '/feedback',
      {
        body: FeedbackBody,
        beforeHandle: ({ request, status }) =>
          foreign(request) ? status(403, { error: 'forbidden_origin' }) : undefined,
        response: {
          200: Sent,
          400: FeedbackInvalid,
          403: Foreign,
          429: Busy,
          502: Down,
          503: Off,
        },
      },
      async ({ body, request, set, status }) => {
        const invalid = invalidFeedback(body)
        if (invalid !== undefined) return status(400, { error: invalid })
        const result = await api.feedback(body, client(request))
        if (result.ok) return status(200, { success: true })
        if (result.error === 'rate_limited') {
          set.headers['retry-after'] = String(result.retryAfter)
          return status(429, { error: result.error })
        }
        if (result.error === 'upstream_failed') return status(502, { error: result.error })
        return status(503, { error: result.error })
      },
    )
}

/** What the schema cannot say: the address is an address, and a one-line field holds one line. */
function invalidContact(body: ContactInput): `invalid_${ContactField}` | undefined {
  if (body.name !== undefined && LINE_BREAK.test(body.name)) return 'invalid_name'
  if (!EMAIL.test(body.email)) return 'invalid_email'
  if (LINE_BREAK.test(body.subject)) return 'invalid_subject'
  return undefined
}

/** A title of spaces is no title: the door takes it trimmed, so it must not be empty then. */
function invalidFeedback(body: FeedbackInput): `invalid_${FeedbackField}` | undefined {
  if (body.title.trim() === '') return 'invalid_title'
  return undefined
}
