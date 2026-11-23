/**
 * Umami's script tag and the `before-send` hook that cleans what it sends (docs/v9/ARCHITECTURE.md, Measurement). The
 * site's base layout and the room app's shell render the same two tags from here, so there is one rewrite and one test.
 * Pure: the build reads the environment and passes the values in.
 */

/** Umami's tracker on our own origin: Traefik maps it onto the instance's script (vps, docs/umami-integration.md). */
export const UMAMI_SCRIPT_SRC = '/api/u/p.js'

/** The global the tracker's `data-before-send` names; the inline script defines it before the tracker loads. */
export const BEFORE_SEND_GLOBAL = 'fppBeforeSend'

/** The part of a payload the hook reads; the rest of it is returned as it came. */
export type SendPayload = {
  url?: unknown
  referrer?: unknown
  title?: unknown
  [key: string]: unknown
}

/**
 * What the tracker may send: a room's path is `/room/:slug` (a slug is a room's name, a number the owner may book as
 * a name), no address carries a query or a fragment (an access code rides in the fragment), and the page title of a
 * room, which is the room's name, becomes "Room" (as on v1). `/room` and `/room/new` are routes, not rooms, and stay.
 *
 * A page view with the same cleaned address and referrer as the last one is cancelled: `/room/new` replaces itself
 * with the room's address, the tracker sends one page view per history change, and by send time both read the room's
 * address (counted twice for the person who creates a room). A real navigation moves the referrer, so it is never a
 * repeat. The last view is kept on `globalThis`, as the function has no scope of its own to keep it in and the module
 * reads no clock. An event (a payload with a `name`) is never cancelled.
 *
 * It ships as text (`beforeSendScript`), so it is one self-contained function: it uses nothing outside its own body.
 */
export function beforeSend(type: string, payload: SendPayload): SendPayload | false {
  // Inside the function on purpose: the whole of it is shipped as text, so nothing may live outside its body.
  // oxlint-disable-next-line unicorn/consistent-function-scoping
  const clean = (value: unknown): unknown => {
    if (typeof value !== 'string') return value
    const cut = value.search(/[?#]/)
    const path = cut === -1 ? value : value.slice(0, cut)
    return path.replace(
      /^((?:[a-z][a-z0-9+.-]*:\/\/[^/]*)?)\/room\/(?!new(?:\/|$))[^/]+.*$/i,
      '$1/room/:slug',
    )
  }
  const url = clean(payload.url)
  payload.url = url
  payload.referrer = clean(payload.referrer)
  if (typeof url === 'string' && url.endsWith('/room/:slug')) payload.title = 'Room'
  if (type === 'event' && typeof url === 'string' && payload.name === undefined) {
    const seen = globalThis as { fppLastView?: string }
    const view = `${url} <- ${String(payload.referrer)}`
    if (seen.fppLastView === view) return false
    seen.fppLastView = view
  }
  return payload
}

/** The inline script that defines the hook as a global. */
export function beforeSendScript(): string {
  return `window.${BEFORE_SEND_GLOBAL}=${beforeSend.toString()}`
}

/** The build's two settings for the script: both public. An unset website id means no tag, as in a self-hosted build. */
export type UmamiScriptConfig = {
  readonly websiteId: string | undefined
  /** The hostnames that may send, comma separated: the beta host now, the production one at the cutover. */
  readonly domains: string | undefined
}

const WEBSITE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DOMAINS = /^[a-z0-9.-]+(?:,[a-z0-9.-]+)*$/i

/** The two tags for a page's head, the hook first; an empty string when the build has no website id. */
export function umamiScriptTags(config: UmamiScriptConfig): string {
  const id = config.websiteId?.trim() ?? ''
  if (id === '') return ''
  if (!WEBSITE_ID.test(id)) throw new Error('the Umami website id is not a UUID')
  const domains = config.domains?.replaceAll(' ', '') ?? ''
  if (domains !== '' && !DOMAINS.test(domains))
    throw new Error('the Umami domains are not a comma separated list of hostnames')
  const attributes = [
    'defer',
    `src="${UMAMI_SCRIPT_SRC}"`,
    `data-website-id="${id}"`,
    ...(domains === '' ? [] : [`data-domains="${domains}"`]),
    'data-exclude-search="true"',
    'data-exclude-hash="true"',
    `data-before-send="${BEFORE_SEND_GLOBAL}"`,
  ]
  return `<script>${beforeSendScript()}</script><script ${attributes.join(' ')}></script>`
}
