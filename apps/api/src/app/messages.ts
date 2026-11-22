/**
 * What sends the two messages (docs/v9/ARCHITECTURE.md, HTTP API): the contact form's mail goes to the mail gateway at
 * `<gateway>/fpp` with a bearer secret and a 7 s timeout, the feedback to the factory's door with a bearer token and a
 * 5 s timeout, as v1 did. A route whose upstream is not configured answers `unavailable`, the default of a
 * self-hosted install. Both routes share one kind of limit (`rate-limit.ts`), each with its own window: v1's contact
 * form had none and an open endpoint that writes to the owner's inbox is the one to fill it.
 */
import type { Upstream } from '../env.ts'
import type { ContactInput, FeedbackInput, MessagesApi, SendResult } from '../http/messages.ts'
import { FEEDBACK_LIMITS } from '../http/messages.ts'
import { createRateLimit } from './rate-limit.ts'

export const GATEWAY_TIMEOUT_MS = 7_000
export const DOOR_TIMEOUT_MS = 5_000

export type MessagesOptions = {
  /** `EMAIL_GATEWAY_URL` and its secret; `url` is the gateway's base, the route appends `/fpp`. */
  readonly gateway: Upstream | undefined
  /** `FACTORY_FEEDBACK_URL` (the full door URL, app included) and its token. */
  readonly door: Upstream | undefined
  readonly now: () => number
  /** An upstream that failed, once, for the telemetry boundary: never given the message, address or subject. */
  readonly failed: (error: unknown, at: { component: string; action: string }) => void
  readonly fetch?: typeof fetch
  readonly timeouts?: { readonly gateway?: number; readonly door?: number }
  readonly limits?: {
    readonly perClient?: number
    readonly overall?: number
    readonly windowMs?: number
  }
}

export function createMessages(options: MessagesOptions): MessagesApi {
  const send = options.fetch ?? fetch
  const contactLimit = createRateLimit({ now: options.now, ...options.limits })
  const feedbackLimit = createRateLimit({ now: options.now, ...options.limits })

  async function post(input: {
    readonly to: string
    readonly secret: string
    readonly body: unknown
    readonly timeoutMs: number
    readonly at: { component: string; action: string }
  }): Promise<SendResult> {
    try {
      const response = await send(input.to, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${input.secret}` },
        body: JSON.stringify(input.body),
        signal: AbortSignal.timeout(input.timeoutMs),
      })
      // The answer's body is never read: nothing it says is ours to relay or log.
      void response.body?.cancel()
      if (!response.ok) throw new UpstreamRefused(response.status)
      return { ok: true }
    } catch (error) {
      options.failed(error, input.at)
      return { ok: false, error: 'upstream_failed' }
    }
  }

  return {
    async contact(input: ContactInput, client) {
      if (options.gateway === undefined) return { ok: false, error: 'unavailable' }
      const wait = contactLimit.take(client)
      if (wait !== undefined) return { ok: false, error: 'rate_limited', retryAfter: wait }
      return post({
        to: `${options.gateway.url}/fpp`,
        secret: options.gateway.secret,
        body: {
          name: input.name,
          email: input.email,
          subject: input.subject,
          message: input.message,
        },
        timeoutMs: options.timeouts?.gateway ?? GATEWAY_TIMEOUT_MS,
        at: { component: 'contact', action: 'send' },
      })
    },
    async feedback(input: FeedbackInput, client) {
      if (options.door === undefined) return { ok: false, error: 'unavailable' }
      const wait = feedbackLimit.take(client)
      if (wait !== undefined) return { ok: false, error: 'rate_limited', retryAfter: wait }
      const text = input.text?.trim()
      return post({
        to: options.door.url,
        secret: options.door.secret,
        body: {
          title: input.title.trim().slice(0, FEEDBACK_LIMITS.title.max),
          ...(text ? { text: text.slice(0, FEEDBACK_LIMITS.text.max) } : {}),
          version: input.version,
          route: input.route,
        },
        timeoutMs: options.timeouts?.door ?? DOOR_TIMEOUT_MS,
        at: { component: 'feedback', action: 'send' },
      })
    },
  }
}

/** The upstream answered, with a status that is no success; the status is all it says. */
class UpstreamRefused extends Error {
  constructor(readonly status: number) {
    super('the upstream refused the message')
    this.name = 'UpstreamRefused'
  }
}
