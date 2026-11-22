import { describe, expect, test } from 'bun:test'
import {
  BEFORE_SEND_GLOBAL,
  beforeSend,
  beforeSendScript,
  umamiScriptTags,
  type SendPayload,
} from '../src/umami-script.ts'

const ID = '123e4567-e89b-42d3-a456-426614174000'

/** The hook as the page runs it: the inline script's text, evaluated alone. */
function shipped(): (type: string, payload: SendPayload) => SendPayload {
  const host: Record<string, unknown> = {}
  new Function('window', beforeSendScript())(host)
  return host[BEFORE_SEND_GLOBAL] as (type: string, payload: SendPayload) => SendPayload
}

describe.each([
  ['the function', beforeSend],
  ['the script as shipped', shipped()],
])('before-send, %s', (_name, hook) => {
  const send = (url: string, extra: SendPayload = {}) => hook('event', { url, ...extra }).url

  test('a room path is /room/:slug, with no query and no fragment', () => {
    expect(send('/room/team-alpha#code')).toBe('/room/:slug')
    expect(send('/room/123456?x=1')).toBe('/room/:slug')
    expect(send('/room/team-alpha?x=1#blue%20sky')).toBe('/room/:slug')
    expect(send('/room/team-alpha/anything')).toBe('/room/:slug')
    expect(send('https://next.example/room/123456#code')).toBe('https://next.example/room/:slug')
  })

  test('a page that is no room keeps its path and loses its query and fragment', () => {
    expect(send('/')).toBe('/')
    expect(send('/guide?utm=x#top')).toBe('/guide')
    expect(send('/room')).toBe('/room')
    expect(send('/room/new')).toBe('/room/new')
    expect(send('/roommate/x')).toBe('/roommate/x')
    expect(send('/rooms/x')).toBe('/rooms/x')
  })

  test('the referrer is cleaned the same way', () => {
    expect(hook('event', { referrer: 'https://x.example/room/team-alpha#code' }).referrer).toBe(
      'https://x.example/room/:slug',
    )
    expect(hook('event', { referrer: 'https://search.example/?q=a#b' }).referrer).toBe(
      'https://search.example/',
    )
  })

  test('the title of a room, which is its name, becomes Room; another title stays', () => {
    expect(send('/room/team-alpha', { title: 'Team Alpha' })).toBe('/room/:slug')
    expect(hook('event', { url: '/room/team-alpha', title: 'Team Alpha' }).title).toBe('Room')
    expect(hook('event', { url: '/guide', title: 'Guide' }).title).toBe('Guide')
  })

  test('the payload is returned, with what the hook does not read untouched', () => {
    const payload = { url: '/room/x', name: 'room_created', data: { activity: 'poker' } }
    expect(hook('event', payload)).toEqual({
      url: '/room/:slug',
      referrer: undefined,
      title: 'Room',
      name: 'room_created',
      data: { activity: 'poker' },
    })
    expect(hook('identify', { data: { a: 1 } } as SendPayload).url).toBeUndefined()
  })
})

describe('the script tags', () => {
  test('no website id, no tag', () => {
    expect(umamiScriptTags({ websiteId: undefined, domains: 'a.example' })).toBe('')
    expect(umamiScriptTags({ websiteId: ' ', domains: undefined })).toBe('')
  })

  test('the hook comes first, the tracker is deferred and names it, from our own origin', () => {
    const tags = umamiScriptTags({ websiteId: ID, domains: 'next.example, www.example' })
    expect(tags.startsWith(`<script>window.${BEFORE_SEND_GLOBAL}=`)).toBe(true)
    expect(tags).toContain(
      `<script defer src="/api/u/p.js" data-website-id="${ID}" data-domains="next.example,www.example" data-exclude-search="true" data-exclude-hash="true" data-before-send="${BEFORE_SEND_GLOBAL}"></script>`,
    )
    expect(tags.indexOf('window.')).toBeLessThan(tags.indexOf('defer'))
    expect(tags).not.toContain('</script><script></script>')
  })

  test('a domain list is optional', () => {
    expect(umamiScriptTags({ websiteId: ID, domains: undefined })).not.toContain('data-domains')
  })

  test('a malformed id or domain list stops the build', () => {
    expect(() => umamiScriptTags({ websiteId: 'x" onload="y', domains: undefined })).toThrow()
    expect(() => umamiScriptTags({ websiteId: ID, domains: 'a.example"><script>' })).toThrow()
  })
})
